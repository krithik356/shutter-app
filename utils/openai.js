/**
 * AI client utility (OpenAI SDK — compatible with OpenAI, Google Gemini,
 * and other OpenAI-compatible providers)
 *
 * Text generation model is configurable via OPENAI_MODEL env var.
 * Base URL is configurable via OPENAI_BASE_URL env var.
 */

import OpenAI from 'openai';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

let _client = null;

export function isGeminiMode() {
  return !!process.env.GEMINI_API_KEY?.trim() ||
    !!process.env.OPENAI_BASE_URL?.includes('googleapis.com');
}

// ── Real client initialisation ──────────────────────────────────

/** Lazily initialise the OpenAI-compatible client. */
function getClient() {
  if (_client) return _client;

  const apiKey = process.env.OPENAI_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('No AI API key is configured. Set OPENAI_API_KEY or GEMINI_API_KEY in your .env');
  }

  const isGemini = !!process.env.GEMINI_API_KEY?.trim();
  const normalizedBaseUrl = process.env.OPENAI_BASE_URL?.trim();
  const baseUrl = normalizedBaseUrl || (isGemini ? 'https://gemini.googleapis.com/v1' : undefined);

  const opts = { apiKey };
  if (baseUrl) {
    opts.baseURL = baseUrl.replace(/\/?$/, '');
  }

  console.debug('[AI] getClient', {
    provider: isGemini ? 'Gemini' : 'OpenAI',
    baseURL: opts.baseURL,
    model: process.env.OPENAI_MODEL || (isGemini ? 'gemini-pro' : 'gpt-4o'),
  });

  _client = new OpenAI(opts);
  return _client;
}

// ── Text generation ─────────────────────────────────────────────

/**
 * Generate a text completion.
 */
export async function generateText(systemPrompt, userMessage, maxTokens = 1024) {
  try {
    const client = getClient();
    const isGemini = isGeminiMode();
    const model = process.env.OPENAI_MODEL || (isGemini ? 'gemini-pro' : 'gpt-4o');
    console.debug('[AI] generateText', { provider: isGemini ? 'Gemini' : 'OpenAI', model });

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
 * For OpenAI: uses DALL-E 3 (n=1 per call, parallel for multiple).
 * For Gemini: uses imagen-3.0-generate-002 via the compatibility layer.
 *
 * NOTE: Each parallel call is billed separately — 3 calls = 3× cost.
 */
export async function generateImages(prompt, count = 3) {
  const isGemini = isGeminiMode();

  try {
    const client = getClient();
    const imageModel = isGemini ? 'imagen-3.0-generate-002' : 'dall-e-3';
    console.debug('[AI] generateImages', { provider: isGemini ? 'Gemini' : 'OpenAI', model: imageModel });

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
