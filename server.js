/**
 * TODO — AUTHENTICATION REQUIRED BEFORE DEPLOYMENT
 * ──────────────────────────────────────────────────
 * The /api/save and /api/load endpoints below currently have NO
 * authentication or authorization. They are wide-open for local
 * development convenience only.
 *
 * Before any real deployment (staging, production, public demo):
 *   1. Add an auth layer (JWT, session cookies, OAuth, etc.)
 *   2. Validate & sanitize all incoming request bodies
 *   3. Rate-limit the endpoints
 *   4. Restrict CORS origins to your actual frontend domain
 *
 * DO NOT ship this server to any publicly-accessible environment
 * without addressing the above.
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import cron from 'node-cron';
import { createDecipheriv } from 'node:crypto';
import { scrapeSite } from './utils/scrapeSite.js';
import { generateJSON, generateImages } from './utils/openai.js';
import instagramRouter from './routes/instagram.js';

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ── Startup checks ──────────────────────────────────────────────
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌  MONGODB_URI is not set in .env — exiting.');
  process.exit(1);
}

if (!process.env.OPENAI_BASE_URL?.trim() && process.env.GEMINI_API_KEY?.trim()) {
  process.env.OPENAI_BASE_URL = 'https://gemini.googleapis.com/v1';
}

const aiKey = process.env.OPENAI_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim();
if (!aiKey) {
  console.error('❌  No AI API key found. Set OPENAI_API_KEY or GEMINI_API_KEY in .env and restart the server.');
  process.exit(1);
}
if (process.env.GEMINI_API_KEY?.trim()) {
  console.log('🔑  Gemini API key detected — using Gemini via OpenAI-compatible SDK');
} else {
  console.log('🔑  OPENAI_API_KEY detected — using real OpenAI calls');
}

// ── MongoDB connection ──────────────────────────────────────────
mongoose
  .connect(MONGODB_URI)
  .then(() => console.log('✅  Connected to MongoDB (shutter database)'))
  .catch((err) => {
    console.error('❌  MongoDB connection error:', err.message);
  });

// ── Mongoose schemas / models ───────────────────────────────────

const configSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true },
);
const Config = mongoose.model('Config', configSchema);

const userSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true },
    brandKit: {
      businessName: String,
      summary: String,
      colors: [String],
      products: [String],
      tone: String,
    },
    // Instagram account connection — access token stored encrypted (AES-256-CBC)
    igAccount: {
      igBusinessId: String,
      username: String,
      accessToken: String,   // encrypted ciphertext — never stored plaintext
      tokenExpiresAt: Date,
    },
    updatedAt: Date,
  },
  { timestamps: true },
);
const User = mongoose.model('User', userSchema);

// Posts collection — append-only, one doc per generated + published ad
const postSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    promptUsed: String,
    imageUrl: String,
    caption: String,
    hashtags: [String],
    status: {
      type: String,
      enum: ['pending', 'approved', 'posted', 'rejected'],
      default: 'pending',
    },
    scheduledFor: Date,
    postedAt: Date,
  },
  { timestamps: true },
);
// Compound index for dashboard history queries
postSchema.index({ userId: 1, createdAt: -1 });
postSchema.index({ status: 1 });
const Post = mongoose.model('Post', postSchema);

// ── Routes ──────────────────────────────────────────────────────

// Health / connection status
app.get('/api/db-status', async (_req, res) => {
  const state = mongoose.connection.readyState;
  const labels = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
  res.json({
    status: labels[state] ?? 'unknown',
    database: mongoose.connection.name || null,
  });
});

// Save a config entry  (upsert by key) — NO AUTH (see top-of-file TODO)
app.post('/api/save', async (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ error: 'key is required' });

    const doc = await Config.findOneAndUpdate(
      { key },
      { value },
      { upsert: true, new: true, runValidators: true },
    );
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Load a config entry by key — NO AUTH (see top-of-file TODO)
app.get('/api/load/:key', async (req, res) => {
  try {
    const doc = await Config.findOne({ key: req.params.key });
    if (!doc) return res.status(404).json({ error: 'not found' });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// AI generation endpoints
// ─────────────────────────────────────────────────────────────────

// POST /api/brand-kit — NO AUTH (see top-of-file TODO)
// Scrapes the given website and uses OpenAI to produce a structured brand kit.
app.post('/api/brand-kit', async (req, res) => {
  try {
    const { userId, websiteUrl } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    if (!websiteUrl) return res.status(400).json({ error: 'websiteUrl is required' });

    // 1. Scrape
    const scrapeResult = await scrapeSite(websiteUrl);
    if (!scrapeResult.ok) {
      return res.status(422).json({ error: `Scrape failed: ${scrapeResult.error}` });
    }

    const { data } = scrapeResult;

    // 2. Ask OpenAI to produce the brand kit JSON
    const systemPrompt = `You are a brand analyst. Given raw website content, produce a JSON object with exactly these keys:
{
  "businessName": "string — the business / brand name",
  "summary": "string — 1-2 sentence description of what the business does, its vibe, and target audience",
  "colors": ["array of 3-5 hex color codes found on the site; if you can't find enough, infer brand-appropriate defaults"],
  "products": ["array of products or services offered, with prices if visible"],
  "tone": "string — describe the brand's tone of voice in 3-5 words, e.g. 'warm, playful, community-focused'"
}
Return ONLY the JSON object. No markdown fences, no commentary.`;

    const userMessage = `Website: ${data.url}
Title: ${data.title || '(none)'}
Meta description: ${data.metaDescription || '(none)'}
Headings: ${data.headings.join(' | ') || '(none)'}
Content:
${data.paragraphText || '(none)'}
Images found: ${data.images.join(', ') || '(none)'}`;

    const brandKit = await generateJSON(systemPrompt, userMessage, 1024);

    // 3. Save to MongoDB (upsert by userId)
    const saved = await User.findOneAndUpdate(
      { userId },
      { brandKit, updatedAt: new Date() },
      { upsert: true, returnDocument: 'after', runValidators: true },
    );

    res.json(saved.brandKit);
  } catch (err) {
    console.error('/api/brand-kit error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/generate-concept — NO AUTH (see top-of-file TODO)
// Generates a single ad concept + image prompt based on the user's saved brand kit.
app.post('/api/generate-concept', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    // Load brand kit
    const user = await User.findOne({ userId });
    if (!user?.brandKit) {
      return res.status(404).json({ error: 'No brand kit found for this user. Run /api/brand-kit first.' });
    }

    const bk = user.brandKit;

    const systemPrompt = `You are an expert social-media ad strategist. Given a brand kit, generate ONE ad concept for today's post.

Rotate through these angles — pick ONE that would create variety:
• Product highlight — showcase a specific product
• Promo / offer — feature a discount, sale, or limited-time deal
• Educational — teach something related to the product category
• Lifestyle — show the product in an aspirational real-life context

Return ONLY a JSON object:
{
  "conceptTitle": "string — short title describing the concept angle and subject",
  "imagePrompt": "string — a detailed image-generation prompt describing composition, camera angle, lighting, color palette (use the brand colors), props, mood, and any text/badge overlays. Be specific and vivid, 2-4 sentences."
}
No markdown fences, no extra text.`;

    const userMessage = `Brand Kit:
Business: ${bk.businessName}
Summary: ${bk.summary}
Colors: ${bk.colors?.join(', ')}
Products: ${bk.products?.join(', ')}
Tone: ${bk.tone}`;

    const concept = await generateJSON(systemPrompt, userMessage, 1024);
    res.json(concept);
  } catch (err) {
    console.error('/api/generate-concept error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/generate-caption — NO AUTH (see top-of-file TODO)
// Generates a caption + hashtags for a given concept, matching the brand's tone.
app.post('/api/generate-caption', async (req, res) => {
  try {
    const { userId, conceptTitle } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    if (!conceptTitle) return res.status(400).json({ error: 'conceptTitle is required' });

    // Load brand kit
    const user = await User.findOne({ userId });
    if (!user?.brandKit) {
      return res.status(404).json({ error: 'No brand kit found for this user. Run /api/brand-kit first.' });
    }

    const bk = user.brandKit;

    const systemPrompt = `You are a social-media copywriter. Write a short Instagram caption (2–4 sentences) that matches the brand's tone, plus 4–6 relevant hashtags.

Return ONLY a JSON object:
{
  "caption": "string — the caption text, 2-4 sentences",
  "hashtags": ["array", "of", "hashtag", "strings", "without the # symbol"]
}
No markdown fences, no extra text.`;

    const userMessage = `Brand Kit:
Business: ${bk.businessName}
Summary: ${bk.summary}
Tone: ${bk.tone}
Products: ${bk.products?.join(', ')}

Ad Concept: ${conceptTitle}`;

    const caption = await generateJSON(systemPrompt, userMessage, 512);
    res.json(caption);
  } catch (err) {
    console.error('/api/generate-caption error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/generate-images — NO AUTH (see top-of-file TODO)
// Generates images via DALL-E 3 for the given prompt.
// NOTE: DALL-E 3 supports only n=1 per call, so we fire 3 parallel
// requests via Promise.all. Each call is billed separately — 3 calls
// = 3× the cost of a single generation.
app.post('/api/generate-images', async (req, res) => {
  try {
    const { userId, imagePrompt } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    if (!imagePrompt) return res.status(400).json({ error: 'imagePrompt is required' });

    const images = await generateImages(imagePrompt, 3);
    res.json({ images });
  } catch (err) {
    console.error('/api/generate-images error:', err);

    // Surface content-policy rejections as 422 rather than 500
    if (err.message.includes('content policy')) {
      return res.status(422).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

// ── Instagram routes ────────────────────────────────────────────
// Passes User and Post models via app.locals so the router doesn't re-import
app.locals.User = User;
app.locals.Post = Post;
app.use(instagramRouter);

// ── Token decryption helper (duplicated from routes/instagram.js for the cron job)
function decryptToken(ciphertext) {
  const key = process.env.TOKEN_ENCRYPTION_KEY;
  if (ciphertext.startsWith('unencrypted:')) {
    return ciphertext.slice('unencrypted:'.length);
  }
  if (!key || key.length !== 64) {
    throw new Error('TOKEN_ENCRYPTION_KEY is not configured');
  }
  const [ivHex, encHex] = ciphertext.split(':');
  const keyBuf = Buffer.from(key, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = createDecipheriv('aes-256-cbc', keyBuf, iv);
  const decrypted = Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]);
  return decrypted.toString('utf8');
}

// ── Scheduled post cron job ─────────────────────────────────────
// Runs every minute. Finds pending posts whose scheduledFor <= now,
// then publishes each one via Instagram's two-step API.
cron.schedule('* * * * *', async () => {
  try {
    const now = new Date();
    const pendingPosts = await Post.find({
      status: 'pending',
      scheduledFor: { $lte: now },
    }).limit(5); // process up to 5 per tick to avoid overload

    if (pendingPosts.length === 0) return;

    console.log(`⏰ Cron: found ${pendingPosts.length} scheduled post(s) ready to publish`);

    for (const post of pendingPosts) {
      try {
        const user = await User.findOne({ userId: post.userId });
        const ig = user?.igAccount;

        if (!ig?.accessToken || !ig?.igBusinessId) {
          console.error(`⏰ Cron: skipping post ${post._id} — no IG connection for user ${post.userId}`);
          post.status = 'rejected';
          await post.save();
          continue;
        }

        if (ig.tokenExpiresAt && new Date(ig.tokenExpiresAt) < now) {
          console.error(`⏰ Cron: skipping post ${post._id} — IG token expired`);
          post.status = 'rejected';
          await post.save();
          continue;
        }

        const accessToken = decryptToken(ig.accessToken);
        const igId = ig.igBusinessId;

        // Step 1: Create media container
        const containerParams = new URLSearchParams({
          image_url: post.imageUrl,
          caption: post.caption || '',
          access_token: accessToken,
        });

        const containerRes = await fetch(`https://graph.instagram.com/v21.0/${igId}/media`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: containerParams.toString(),
        });
        const containerData = await containerRes.json();

        if (!containerRes.ok || !containerData.id) {
          console.error(`⏰ Cron: container creation failed for post ${post._id}:`, containerData.error?.message);
          post.status = 'rejected';
          await post.save();
          continue;
        }

        // Brief pause before publishing
        await new Promise((r) => setTimeout(r, 2000));

        // Step 2: Publish
        const publishParams = new URLSearchParams({
          creation_id: containerData.id,
          access_token: accessToken,
        });

        const publishRes = await fetch(`https://graph.instagram.com/v21.0/${igId}/media_publish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: publishParams.toString(),
        });
        const publishData = await publishRes.json();

        if (!publishRes.ok || !publishData.id) {
          console.error(`⏰ Cron: publish failed for post ${post._id}:`, publishData.error?.message);
          post.status = 'rejected';
          await post.save();
          continue;
        }

        post.status = 'posted';
        post.postedAt = new Date();
        await post.save();
        console.log(`📸 Cron: Published scheduled post ${post._id} to @${ig.username}`);
      } catch (err) {
        console.error(`⏰ Cron: error publishing post ${post._id}:`, err.message);
        post.status = 'rejected';
        await post.save();
      }
    }
  } catch (err) {
    // Silently swallow top-level cron errors — don't crash the server
    console.error('⏰ Cron: unexpected error:', err.message);
  }
});
console.log('⏰ Scheduled-post cron job running (checks every minute)');

// ── Start ───────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀  API server running on http://localhost:${PORT}`);
});
