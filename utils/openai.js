/**
 * AI client utility (OpenAI SDK — compatible with OpenAI, Google Gemini,
 * and other OpenAI-compatible providers)
 *
 * Supports a mock/fallback mode for development and demos:
 *   - If USE_MOCK_AI=true in .env, or OPENAI_API_KEY is missing/empty,
 *     all calls return realistic canned responses with an artificial delay.
 *   - When a real key is provided and USE_MOCK_AI is unset or false,
 *     real API calls are made automatically — zero code changes needed.
 *
 * Text generation model is configurable via OPENAI_MODEL env var.
 * Base URL is configurable via OPENAI_BASE_URL env var.
 */

import OpenAI from 'openai';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

let _client = null;

// ── Mock mode detection ─────────────────────────────────────────

/**
 * Returns true if mock mode is active:
 *   - USE_MOCK_AI is explicitly "true", OR
 *   - OPENAI_API_KEY is missing/empty (auto-fallback)
 */
export function isMockMode() {
  if (process.env.USE_MOCK_AI === 'true') return true;
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.trim() === '') return true;
  return false;
}

/** Artificial delay (800–1500 ms) so frontend loading states get exercised. */
function mockDelay() {
  const ms = 800 + Math.random() * 700;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Mock data (mirrors src/data/mockData.js for consistency) ────

const MOCK_BRAND_KIT = {
  businessName: 'North Brew Coffee',
  summary:
    'North Brew Coffee — a small-batch coffee roaster and café. Sells single-origin beans, subscriptions, and brewing gear. Tone is warm, unpretentious, community-focused.',
  colors: ['#2B4C3F', '#C97B3D', '#F4EFE6', '#1A1A1A'],
  products: [
    'Ethiopia Yirgacheffe — $18',
    'Colombia Reserve — $16',
    'Monthly subscription',
    'Pour-over kit',
  ],
  tone: 'warm, unpretentious, community-focused',
};

const MOCK_CONCEPT = {
  conceptTitle:
    'Product highlight: Ethiopia Yirgacheffe bag, morning light, promoting the new-customer discount.',
  imagePrompt:
    'Overhead shot of a matte kraft coffee bag labeled "Ethiopia Yirgacheffe" on a rustic wood table, soft morning window light from the left, a few scattered coffee beans and a steaming ceramic cup nearby, warm forest-green and terracotta color palette (#2B4C3F, #C97B3D), shallow depth of field, minimal and editorial, space reserved top-right for a small "15% off first order" badge.',
};

const MOCK_CAPTION = {
  caption:
    "Mornings are better with something worth waking up for. Our Ethiopia Yirgacheffe just landed — bright, floral, a little bit of citrus. New here? Take 15% off your first bag, link in bio.",
  hashtags: [
    'specialtycoffee',
    'ethiopiacoffee',
    'smallbatchroaster',
    'coffeelovers',
    'pourover',
    'coffeetime',
  ],
};

// ── Real client initialisation ──────────────────────────────────

/** Lazily initialise the OpenAI-compatible client. */
function getClient() {
  if (_client) return _client;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set — cannot create real AI client');
  }
  const opts = { apiKey };
  if (process.env.OPENAI_BASE_URL) {
    opts.baseURL = process.env.OPENAI_BASE_URL;
  }
  _client = new OpenAI(opts);
  return _client;
}

// ── Text generation ─────────────────────────────────────────────

/**
 * Generate a text completion.
 * In mock mode, returns a canned string (the caller — usually generateJSON —
 * will JSON.parse it).
 */
export async function generateText(systemPrompt, userMessage, maxTokens = 1024) {
  // ── Mock path ───────────────────────────────────────────────
  if (isMockMode()) {
    await mockDelay();

    // Determine which mock to return based on the system prompt content
    if (systemPrompt.includes('brand analyst')) {
      return JSON.stringify(MOCK_BRAND_KIT);
    }
    if (systemPrompt.includes('ad strategist')) {
      return JSON.stringify(MOCK_CONCEPT);
    }
    if (systemPrompt.includes('copywriter')) {
      return JSON.stringify(MOCK_CAPTION);
    }

    // Generic fallback
    return JSON.stringify({ mock: true, message: 'Mock AI response' });
  }

  // ── Real path ───────────────────────────────────────────────
  try {
    const client = getClient();
    const model = process.env.OPENAI_MODEL || 'gpt-4o';

    const completion = await client.chat.completions.create({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    });

    const text = completion.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error('AI response contained no text content');
    }
    return text;
  } catch (err) {
    if (err.status === 401 || err.code === 'invalid_api_key') {
      throw new Error(`AI auth failure: ${err.message}`);
    }
    if (err.status === 429) {
      const isQuota = err.code === 'insufficient_quota' ||
        err.message?.includes('quota') ||
        err.message?.includes('billing');
      if (isQuota) {
        throw new Error(`AI quota exceeded — check your plan and billing. ${err.message}`);
      }
      throw new Error(`AI rate-limit hit (429). Retry in a few seconds. ${err.message}`);
    }
    if (err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED') {
      throw new Error(`AI request timed out: ${err.message}`);
    }
    throw err;
  }
}

// ── JSON generation (with retry) ────────────────────────────────

/**
 * Call the AI expecting JSON back, with one retry if parsing fails.
 */
export async function generateJSON(systemPrompt, userMessage, maxTokens = 1024) {
  const raw = await generateText(systemPrompt, userMessage, maxTokens);
  const parsed = tryParseJSON(raw);
  if (parsed !== null) return parsed;

  // Retry once — ask the model to fix the JSON
  const retryMessage =
    'Your previous response was not valid JSON. Please respond with ONLY the corrected JSON object, no markdown fences, no extra text.';
  const retryRaw = await generateText(systemPrompt, retryMessage, maxTokens);
  const retryParsed = tryParseJSON(retryRaw);
  if (retryParsed !== null) return retryParsed;

  throw new Error('AI failed to return valid JSON after retry');
}

// ── Image generation ────────────────────────────────────────────

// Directory to store generated images served by Express
const IMAGES_DIR = join(process.cwd(), 'public', 'generated');

/**
 * Generate images using the AI provider's image generation API.
 *
 * In mock mode, returns 3 distinct placeholder images from picsum.photos.
 *
 * For OpenAI: uses DALL-E 3 (n=1 per call, parallel for multiple).
 * For Gemini: uses imagen-3.0-generate-002 via the compatibility layer.
 *
 * NOTE: Each parallel call is billed separately — 3 calls = 3× cost.
 */
export async function generateImages(prompt, count = 3) {
  // ── Mock path ───────────────────────────────────────────────
  if (isMockMode()) {
    await mockDelay();
    const images = Array.from({ length: count }, (_, i) => {
      const seed = `shutter-${Date.now()}-${i}`;
      return `https://picsum.photos/seed/${seed}/1024/1024`;
    });
    return images;
  }

  // ── Real path ───────────────────────────────────────────────
  const isGemini = !!process.env.OPENAI_BASE_URL?.includes('googleapis.com');

  try {
    const client = getClient();
    const imageModel = isGemini ? 'imagen-3.0-generate-002' : 'dall-e-3';

    const calls = Array.from({ length: count }, () =>
      client.images.generate({
        model: imageModel,
        prompt,
        size: '1024x1024',
        n: 1,
        ...(isGemini ? { response_format: 'b64_json' } : {}),
      }),
    );

    const results = await Promise.all(calls);

    if (!existsSync(IMAGES_DIR)) {
      mkdirSync(IMAGES_DIR, { recursive: true });
    }

    const urls = results.map((r, i) => {
      const item = r.data[0];
      if (item.url) return item.url;
      if (item.b64_json) {
        const filename = `img_${Date.now()}_${i}.png`;
        const filepath = join(IMAGES_DIR, filename);
        writeFileSync(filepath, Buffer.from(item.b64_json, 'base64'));
        return `/generated/${filename}`;
      }
      throw new Error('Image response contained neither url nor b64_json');
    });

    return urls;
  } catch (err) {
    if (err.code === 'content_policy_violation' || err.message?.includes('content policy')) {
      throw new Error(`Image prompt rejected by content policy: ${err.message}`);
    }
    if (err.status === 429) {
      throw new Error(`Rate-limit hit during image generation: ${err.message}`);
    }
    throw err;
  }
}

// ── Helpers ─────────────────────────────────────────────────────

function tryParseJSON(text) {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  cleaned = cleaned.trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}
