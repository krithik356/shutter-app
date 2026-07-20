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
  process.env.OPENAI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/';
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
    schedule: {
      postTime: { type: String, default: '21:00' }, // "HH:MM" format
      timezone: { type: String, default: 'UTC' },
      autoApprove: { type: Boolean, default: true },
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
    const { userId, websiteUrl, timezone } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    if (!websiteUrl) return res.status(400).json({ error: 'websiteUrl is required' });

    // ── DEMO MODE — no AI key needed ─────────────────────────────
    if (process.env.DEMO_MODE === 'true') {
      console.debug('[DEMO] /api/brand-kit — returning dummy brand kit');
      const demoBrandKit = {
        businessName: 'Lumière Skincare',
        summary: 'Lumière Skincare — a clean beauty brand crafting science-backed serums, moisturizers, and SPFs. Targeted at health-conscious millennials who want effective, ingredient-transparent skincare without the fluff.',
        colors: ['#F8F4EF', '#C9A97A', '#3D3530', '#7B9E8A', '#E8D5C4'],
        products: ['Vitamin C Brightening Serum — $48', 'Barrier Repair Moisturizer — $52', 'SPF 50 Daily Shield — $38', 'Retinol Night Elixir — $62', 'Skincare Layering Kit — $129'],
        tone: 'clean, confident, educational, approachable',
      };
      // Save demo brand kit to DB so downstream steps work
      const updateFields = {
        brandKit: demoBrandKit,
        updatedAt: new Date(),
      };
      if (timezone) {
        updateFields['schedule.timezone'] = timezone;
      }
      const saved = await User.findOneAndUpdate(
        { userId },
        { $set: updateFields },
        { upsert: true, returnDocument: 'after', runValidators: true },
      );
      return res.json(saved.brandKit);
    }

    // ── Real AI scrape + generate ─────────────────────────────────
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
    const updateFields = {
      brandKit,
      updatedAt: new Date(),
    };
    if (timezone) {
      updateFields['schedule.timezone'] = timezone;
    }
    const saved = await User.findOneAndUpdate(
      { userId },
      { $set: updateFields },
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

    // ── DEMO MODE ─────────────────────────────────────────────────
    if (process.env.DEMO_MODE === 'true') {
      console.debug('[DEMO] /api/generate-concept — returning dummy concept');
      const demoConcepts = [
        {
          conceptTitle: 'Educational — Skincare Layering 101',
          imagePrompt: 'Flat lay of 5 skincare products arranged in application order on a soft linen surface, warm morning light from the left, elegant gold text overlay reading "Layer it right" in top-left corner, muted cream and terracotta color palette, editorial and minimal, shallow depth of field with soft bokeh background.',
        },
        {
          conceptTitle: 'Product Highlight — Vitamin C Serum',
          imagePrompt: 'Close-up of a glass dropper bottle of Vitamin C serum with 2-3 drops falling in golden light, fresh orange slice and green leaves as props, clean white background with warm shadows, bright and energetic color palette, macro lens aesthetic, lifestyle skincare photography.',
        },
        {
          conceptTitle: 'Lifestyle — Morning Glow Routine',
          imagePrompt: 'Woman in a white robe applying moisturizer at a sunlit bathroom vanity, soft diffused natural light through sheer curtains, Lumière products arranged neatly on marble counter, calm and aspirational mood, warm neutral tones, lifestyle photography with shallow depth of field.',
        },
      ];
      const idx = Math.floor(Date.now() / 60000) % demoConcepts.length;
      return res.json(demoConcepts[idx]);
    }

    // ── Real AI generation ────────────────────────────────────────
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

    // ── Demo mode — no API key needed ─────────────────────────────
    // Set ENABLE_CAPTION_GEN=true in .env to switch to real AI generation.
    if (process.env.ENABLE_CAPTION_GEN !== 'true') {
      const demoCaptions = [
        {
          caption: `Unlock the secret to glowing skin with our latest routine. 🌿 Layering your skincare in the right order makes all the difference — we're breaking it down step by step. Your skin deserves the best, and we're here to guide you every glow-up of the way. Try it tonight and wake up radiant! ✨`,
          hashtags: ['skincare', 'skincareRoutine', 'glowUp', 'skincareTips', 'selfCare', 'beautyCommunity'],
        },
        {
          caption: `Did you know the order you apply your skincare actually matters? 💡 From cleanser to SPF, every layer works harder when applied correctly. We've put together the ultimate guide to skincare layering so you never have to guess again. Your best skin starts here. 🌸`,
          hashtags: ['skincareTips', 'beautyEducation', 'glowingSkin', 'skincareFirst', 'radiantSkin', 'beautyRoutine'],
        },
        {
          caption: `Healthy skin is a journey, not a destination — and we're with you every step. 🧴 Our expert-curated skincare lineup helps you build a routine that actually works for your skin type. Consistency is key, and the results speak for themselves. Start your glow journey today! ✨`,
          hashtags: ['glowJourney', 'skincareGoals', 'skinFirst', 'beautyTips', 'naturalGlow', 'selfLove'],
        },
      ];
      // Pick a caption based on the concept title so same input = same output
      const idx = conceptTitle.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % demoCaptions.length;
      console.debug('[Caption] DEMO mode — returning placeholder (set ENABLE_CAPTION_GEN=true for real captions)');
      return res.json(demoCaptions[idx]);
    }

    // ── Real AI generation (ENABLE_CAPTION_GEN=true) ──────────────
    // Load brand kit
    const user = await User.findOne({ userId });
    if (!user?.brandKit) {
      return res.status(404).json({ error: 'No brand kit found for this user. Run /api/brand-kit first.' });
    }

    const bk = user.brandKit;

    const systemPrompt = `You are a social-media copywriter. Your ONLY job is to output a single JSON object — nothing else. No explanations, no markdown, no code fences.

Write a short Instagram caption (2–4 sentences) matching the brand tone, plus 4–6 relevant hashtags.

Output format (JSON only):
{
  "caption": "<2-4 sentence caption>",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3"]
}

Rules:
- hashtags must NOT include the # symbol
- caption must be plain text, no markdown
- output must be valid JSON only — nothing before or after the JSON object`;

    const userMessage = `Brand Kit:
Business: ${bk.businessName}
Summary: ${bk.summary}
Tone: ${bk.tone}
Products: ${bk.products?.join(', ')}

Ad Concept: ${conceptTitle}`;

    const caption = await generateJSON(systemPrompt, userMessage, 1024);
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

// ── POST /api/instagram/post-direct ─────────────────────────────
// Direct Instagram post using env-configured credentials (INSTAGRAM_USER_ID +
// INSTAGRAM_ACCESS_TOKEN). No OAuth needed — mirrors postToInstagram.js logic.
// Body: { imageUrl, caption }
app.post('/api/instagram/post-direct', async (req, res) => {
  const { imageUrl, caption } = req.body;
  if (!imageUrl) return res.status(400).json({ error: 'imageUrl is required' });
  if (!caption) return res.status(400).json({ error: 'caption is required' });

  const igUserId = process.env.INSTAGRAM_USER_ID;
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  const GRAPH_API = 'https://graph.instagram.com/v21.0';

  if (!igUserId || !accessToken) {
    return res.status(503).json({
      error: 'INSTAGRAM_USER_ID and INSTAGRAM_ACCESS_TOKEN must be set in .env',
    });
  }

  try {
    console.log('[IG Direct] Creating media container...');

    // Step 1: Create media container
    const containerRes = await fetch(`${GRAPH_API}/${igUserId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ image_url: imageUrl, caption, access_token: accessToken }).toString(),
    });

    const containerData = await containerRes.json();
    if (!containerRes.ok || !containerData.id) {
      const msg = containerData?.error?.message || 'Failed to create media container';
      console.error('[IG Direct] Container error:', containerData);
      return res.status(422).json({ error: msg, detail: containerData?.error });
    }

    const containerId = containerData.id;
    console.log('[IG Direct] Container created:', containerId, '— waiting 10s...');

    // Step 2: Wait for Instagram to process
    await new Promise((resolve) => setTimeout(resolve, 10000));

    // Step 3: Publish
    const publishRes = await fetch(`${GRAPH_API}/${igUserId}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ creation_id: containerId, access_token: accessToken }).toString(),
    });

    const publishData = await publishRes.json();
    if (!publishRes.ok || !publishData.id) {
      const msg = publishData?.error?.message || 'Failed to publish media';
      console.error('[IG Direct] Publish error:', publishData);
      return res.status(422).json({ error: msg, detail: publishData?.error });
    }

    console.log(`[IG Direct] ✅ Posted successfully! Post ID: ${publishData.id}`);

    // Save to DB
    await Post.create({
      userId: 'direct-post',
      imageUrl,
      caption,
      status: 'posted',
      postedAt: new Date(),
    });

    res.json({ success: true, igPostId: publishData.id });
  } catch (err) {
    console.error('/api/instagram/post-direct error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/instagram/schedule-post ────────────────────────────
// Schedule a post to be published at a future time via the cron job.
// Body: { userId, imageUrl, caption, scheduledFor (ISO datetime), timezone }
app.post('/api/instagram/schedule-post', async (req, res) => {
  const { userId, imageUrl, caption, scheduledFor, timezone } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId is required' });
  if (!imageUrl) return res.status(400).json({ error: 'imageUrl is required' });
  if (!caption) return res.status(400).json({ error: 'caption is required' });
  if (!scheduledFor) return res.status(400).json({ error: 'scheduledFor (ISO datetime) is required' });

  try {
    // Validate the date is in the future
    const scheduledDate = new Date(scheduledFor);
    const now = new Date();
    if (scheduledDate <= now) {
      return res.status(400).json({ error: 'Scheduled time must be in the future' });
    }

    // Create a pending post (cron job will publish it at scheduledTime)
    const post = await Post.create({
      userId,
      imageUrl,
      caption,
      status: 'pending',
      scheduledFor: scheduledDate,
      hashtags: [],
    });

    // Save scheduled post time as user's daily postTime preference (local time representation)
    const tz = timezone || 'UTC';
    const localDateParts = getCurrentDatePartsInTimezone(tz, scheduledDate);
    const hours = String(localDateParts.hour).padStart(2, '0');
    const minutes = String(localDateParts.minute).padStart(2, '0');
    const postTime = `${hours}:${minutes}`;

    await User.findOneAndUpdate(
      { userId },
      { 
        $set: { 
          'schedule.postTime': postTime, 
          'schedule.timezone': tz, 
          'schedule.autoApprove': true 
        } 
      },
      { upsert: true }
    );

    console.log(`📅 Scheduled post ${post._id} for ${scheduledDate.toISOString()} and updated user preference to ${postTime} (${tz})`);
    res.json({ success: true, postId: post._id, scheduledFor: scheduledDate });
  } catch (err) {
    console.error('/api/instagram/schedule-post error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Instagram routes ────────────────────────────────────────────
// Passes User and Post models via app.locals so the router doesn't re-import
app.locals.User = User;
app.locals.Post = Post;
app.use(instagramRouter);


// ── Daily Post Auto-Generation Automation Loop ──────────────────
async function generateDailyPostForUser(user) {
  const bk = user.brandKit;
  if (!bk) return null;

  console.log(`[Daily Auto] Generating post for user ${user.userId} (${bk.businessName})...`);

  // 1. Concept / Prompt
  const conceptSystemPrompt = `You are an expert social-media ad strategist. Given a brand kit, generate ONE ad concept for today's post.

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

  const conceptUserMessage = `Brand Kit:
Business: ${bk.businessName}
Summary: ${bk.summary}
Colors: ${bk.colors?.join(', ')}
Products: ${bk.products?.join(', ')}
Tone: ${bk.tone}`;

  let concept;
  if (process.env.DEMO_MODE === 'true') {
    const angles = ['Lifestyle — Natural look', 'Product Highlight — Premium packaging', 'Educational — Beauty routine'];
    const idx = Math.floor(Math.random() * angles.length);
    concept = {
      conceptTitle: angles[idx],
      imagePrompt: `Clean skincare product photo showcasing ${bk.products?.[0] || 'moisturizer'} on a neutral background, warm lighting, cohesive with brand colors ${bk.colors?.join(', ')}.`
    };
  } else {
    concept = await generateJSON(conceptSystemPrompt, conceptUserMessage, 1024);
  }

  // 2. Image
  let imageUrls;
  if (process.env.DEMO_MODE === 'true') {
    const seed = Math.floor(Math.random() * 1000);
    imageUrls = [`https://picsum.photos/seed/${seed}/1024/1024`];
  } else {
    imageUrls = await generateImages(concept.imagePrompt, 1);
  }
  const imageUrl = imageUrls[0];

  // 3. Caption
  const captionSystemPrompt = `You are a social-media copywriter. Your ONLY job is to output a single JSON object — nothing else. No explanations, no markdown, no code fences.

Write a short Instagram caption (2–4 sentences) matching the brand tone, plus 4–6 relevant hashtags.

Output format (JSON only):
{
  "caption": "<2-4 sentence caption>",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3"]
}

Rules:
- hashtags must NOT include the # symbol
- caption must be plain text, no markdown
- output must be valid JSON only — nothing before or after the JSON object`;

  const captionUserMessage = `Brand Kit:
Business: ${bk.businessName}
Summary: ${bk.summary}
Tone: ${bk.tone}
Products: ${bk.products?.join(', ')}

Ad Concept: ${concept.conceptTitle}`;

  let captionData;
  if (process.env.DEMO_MODE === 'true') {
    captionData = {
      caption: `Unlock your skin's natural radiance with our customized solutions from ${bk.businessName}. Crafted for healthy, glowing skin daily. ✨`,
      hashtags: ['skincare', 'glow', bk.businessName.toLowerCase().replace(/\s+/g, '')]
    };
  } else {
    captionData = await generateJSON(captionSystemPrompt, captionUserMessage, 1024);
  }

  // Calculate scheduled date/time
  const postTime = user.schedule?.postTime || '21:00';
  const tz = user.schedule?.timezone || 'UTC';
  const [hour, minute] = postTime.split(':').map(Number);
  
  const localNow = getCurrentDatePartsInTimezone(tz, new Date());
  
  let scheduledDate = getUtcDateForTimezone(
    localNow.year,
    localNow.month,
    localNow.day,
    hour,
    minute,
    tz
  );
  
  if (scheduledDate <= new Date()) {
    // If the time has already passed today in the user's timezone, schedule for tomorrow
    const tempDate = new Date(Date.UTC(localNow.year, localNow.month, localNow.day));
    tempDate.setUTCDate(tempDate.getUTCDate() + 1);
    
    scheduledDate = getUtcDateForTimezone(
      tempDate.getUTCFullYear(),
      tempDate.getUTCMonth(),
      tempDate.getUTCDate(),
      hour,
      minute,
      tz
    );
  }

  const tags = (captionData.hashtags || []).map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ');
  const fullCaption = captionData.caption ? `${captionData.caption}\n\n${tags}` : tags;

  const post = await Post.create({
    userId: user.userId,
    promptUsed: concept.imagePrompt,
    imageUrl,
    caption: fullCaption,
    status: 'pending',
    scheduledFor: scheduledDate,
  });

  console.log(`[Daily Auto] Scheduled automatic post ${post._id} for ${scheduledDate.toISOString()}`);
  return post;
}

// Check every 15 minutes to pre-generate posts
cron.schedule('*/15 * * * *', async () => {
  try {
    const users = await User.find({});
    for (const user of users) {
      if (!user.brandKit) continue;

      const now = new Date();
      // Check if user already has a pending scheduled post in the future
      const existingPending = await Post.findOne({
        userId: user.userId,
        status: 'pending',
        scheduledFor: { $gt: now },
      });

      if (!existingPending) {
        console.log(`⏰ Auto-Gen: User ${user.userId} lacks a future pending post. Generating now...`);
        try {
          await generateDailyPostForUser(user);
        } catch (genErr) {
          console.error(`❌ Auto-Gen: Failed to generate post for user ${user.userId}:`, genErr.message);
        }
      }
    }
  } catch (err) {
    console.error('⏰ Auto-Gen: Unexpected error in daily generation loop:', err.message);
  }
});
console.log('⏰ Auto-generation cron job running (checks every 15 minutes)');

// ── Timezone Helper Functions ────────────────────────────────────
function getCurrentDatePartsInTimezone(timezone, date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });
  
  const parts = formatter.formatToParts(date);
  const partMap = Object.fromEntries(parts.map(p => [p.type, p.value]));
  
  return {
    year: parseInt(partMap.year, 10),
    month: parseInt(partMap.month, 10) - 1,
    day: parseInt(partMap.day, 10),
    hour: parseInt(partMap.hour, 10) % 24,
    minute: parseInt(partMap.minute, 10),
  };
}

function getUtcDateForTimezone(year, month, day, hour, minute, timezone) {
  const dateUtc = new Date(Date.UTC(year, month, day, hour, minute, 0));
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });
  
  const parts = formatter.formatToParts(dateUtc);
  const partMap = Object.fromEntries(parts.map(p => [p.type, p.value]));
  
  const fYear = parseInt(partMap.year, 10);
  const fMonth = parseInt(partMap.month, 10) - 1;
  const fDay = parseInt(partMap.day, 10);
  const fHour = parseInt(partMap.hour, 10) % 24;
  const fMinute = parseInt(partMap.minute, 10);
  
  const fDateUtc = Date.UTC(fYear, fMonth, fDay, fHour, fMinute, 0);
  const offset = fDateUtc - dateUtc.getTime();
  
  const targetUtcTime = Date.UTC(year, month, day, hour, minute, 0) - offset;
  return new Date(targetUtcTime);
}

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
      // 1. Acquire atomic lock immediately to prevent double-posting from concurrent server processes
      const lockedPost = await Post.findOneAndUpdate(
        { _id: post._id, status: 'pending' },
        { $set: { status: 'posted' } },
        { new: true }
      );

      if (!lockedPost) {
        console.log(`⏰ Cron: post ${post._id} is already being processed or published. Skipping.`);
        continue;
      }

      try {
        const user = await User.findOne({ userId: lockedPost.userId });
        const ig = user?.igAccount;
        let accessToken;
        let igId;
        let username;

        if (!ig?.accessToken || !ig?.igBusinessId) {
          if (process.env.INSTAGRAM_ACCESS_TOKEN && process.env.INSTAGRAM_USER_ID) {
            console.log(`⏰ Cron: using developer fallback credentials for post ${lockedPost._id}`);
            accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
            igId = process.env.INSTAGRAM_USER_ID;
            username = 'developer_fallback';
          } else {
            console.error(`⏰ Cron: skipping post ${lockedPost._id} — no IG connection for user ${lockedPost.userId}`);
            lockedPost.status = 'rejected';
            await lockedPost.save();
            continue;
          }
        } else {
          if (ig.tokenExpiresAt && new Date(ig.tokenExpiresAt) < now) {
            console.error(`⏰ Cron: skipping post ${lockedPost._id} — IG token expired`);
            lockedPost.status = 'rejected';
            await lockedPost.save();
            continue;
          }
          try {
            accessToken = decryptToken(ig.accessToken);
          } catch (decErr) {
            console.error(`⏰ Cron: failed to decrypt token for post ${lockedPost._id}:`, decErr.message);
            lockedPost.status = 'rejected';
            await lockedPost.save();
            continue;
          }
          igId = ig.igBusinessId;
          username = ig.username;
        }

        // Step 1: Create media container
        const containerParams = new URLSearchParams({
          image_url: lockedPost.imageUrl,
          caption: lockedPost.caption || '',
          access_token: accessToken,
        });

        const containerRes = await fetch(`https://graph.instagram.com/v21.0/${igId}/media`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: containerParams.toString(),
        });
        const containerData = await containerRes.json();

        if (!containerRes.ok || !containerData.id) {
          console.error(`⏰ Cron: container creation failed for post ${lockedPost._id}:`, containerData.error?.message);
          lockedPost.status = 'rejected';
          await lockedPost.save();
          continue;
        }

        // Brief pause before publishing — wait 10s for Instagram to process the image
        console.log(`⏰ Cron: container created: ${containerData.id} for post ${lockedPost._id} — waiting 10s...`);
        await new Promise((r) => setTimeout(r, 10000));

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
          console.error(`⏰ Cron: publish failed for post ${lockedPost._id}:`, publishData.error?.message);
          lockedPost.status = 'rejected';
          await lockedPost.save();
          continue;
        }

        lockedPost.postedAt = new Date();
        await lockedPost.save();
        console.log(`📸 Cron: Published scheduled post ${lockedPost._id} to @${username}`);
      } catch (err) {
        console.error(`⏰ Cron: error publishing post ${post._id}:`, err.message);
        try {
          await Post.updateOne({ _id: post._id, status: 'posted' }, { $set: { status: 'rejected' } });
        } catch (dbErr) {
          console.error('⏰ Cron: failed to reset status to rejected:', dbErr.message);
        }
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
