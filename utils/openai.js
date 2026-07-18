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
  const baseUrl = normalizedBaseUrl || (isGemini ? 'https://generativelanguage.googleapis.com/v1beta/openai/' : undefined);

  const opts = { apiKey };
  if (baseUrl) {
    // Gemini OpenAI-compat endpoint requires a trailing slash; preserve it.
    opts.baseURL = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
  }

  console.debug('[AI] getClient', {
    provider: isGemini ? 'Gemini' : 'OpenAI',
    baseURL: opts.baseURL,
    model: process.env.OPENAI_MODEL || (isGemini ? 'gemini-3.5-flash' : 'gpt-4o'),
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
    const model = process.env.OPENAI_MODEL || (isGemini ? 'gemini-3.5-flash' : 'gpt-4o');
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
 * Uses response_format: json_object when supported to enforce valid JSON output.
 */
export async function generateJSON(systemPrompt, userMessage, maxTokens = 1024) {
  try {
    // First attempt — request JSON mode directly from the model
    const client = getClient();
    const isGemini = isGeminiMode();
    const model = process.env.OPENAI_MODEL || (isGemini ? 'gemini-3.5-flash' : 'gpt-4o');

    const completion = await client.chat.completions.create({
      model,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content;
    if (!raw) throw new Error('AI response contained no text content');

    const parsed = tryParseJSON(raw);
    if (parsed !== null) return parsed;

    // Retry — ask the model to fix its own output
    const retryCompletion = await client.chat.completions.create({
      model,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
        { role: 'assistant', content: raw },
        { role: 'user', content: 'Your response was not valid JSON. Reply with ONLY the JSON object, no markdown fences, no extra text.' },
      ],
    });

    const retryRaw = retryCompletion.choices?.[0]?.message?.content;
    const retryParsed = tryParseJSON(retryRaw ?? '');
    if (retryParsed !== null) return retryParsed;

    throw new Error('AI failed to return valid JSON after retry');
  } catch (err) {
    if (err.message === 'AI failed to return valid JSON after retry') throw err;
    // json_object mode not supported — fall back to plain text with retry
    const raw = await generateText(systemPrompt, userMessage, maxTokens);
    const parsed = tryParseJSON(raw);
    if (parsed !== null) return parsed;

    const retryRaw = await generateText(
      systemPrompt,
      'Your response was not valid JSON. Reply with ONLY the JSON object, no markdown fences, no extra text.',
      maxTokens,
    );
    const retryParsed = tryParseJSON(retryRaw);
    if (retryParsed !== null) return retryParsed;

    throw new Error('AI failed to return valid JSON after retry');
  }
}

// ── Image generation ────────────────────────────────────────────

// Directory to store generated images served by Express
const IMAGES_DIR = join(process.cwd(), 'public', 'generated');

/**
 * Generate images.
 *
 * Demo mode (default): returns placeholder images from picsum.photos — no API key needed.
 *   Enable real generation by setting ENABLE_IMAGE_GEN=true in .env.
 *
 * Real mode (ENABLE_IMAGE_GEN=true):
 *   - Gemini: uses native generateContent API with responseModalities IMAGE.
 *     Model controlled by GEMINI_IMAGE_MODEL (default: gemini-3.1-flash-lite-image).
 *   - OpenAI: uses DALL-E 3.
 */
export async function generateImages(prompt, count = 3) {
  // ── Demo / placeholder mode (no API key needed) ──────────────
  if (process.env.ENABLE_IMAGE_GEN !== 'true') {
    console.debug('[AI] generateImages — DEMO mode (set ENABLE_IMAGE_GEN=true for real images)');
    // Use picsum.photos with a seed derived from the prompt so results are
    // consistent for the same prompt but vary across different ones.
    const seed = Array.from(prompt).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    return Array.from({ length: count }, (_, i) => {
      const id = ((seed + i * 37) % 1000) + 1; // 1-1000
      return `https://picsum.photos/seed/${id}/1024/1024`;
    });
  }

  // ── Real image generation ────────────────────────────────────
  const isGemini = isGeminiMode();

  if (!existsSync(IMAGES_DIR)) {
    mkdirSync(IMAGES_DIR, { recursive: true });
  }

  if (isGemini) {
    // Native Gemini REST API — the OpenAI-compat endpoint doesn't support image models
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    const imageModel = process.env.GEMINI_IMAGE_MODEL?.trim() || 'gemini-3.1-flash-lite-image';
    console.debug('[AI] generateImages (Gemini native)', { model: imageModel, count });

    const calls = Array.from({ length: count }, async (_, i) => {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${imageModel}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
          }),
        }
      );

      if (!resp.ok) {
        const errBody = await resp.json().catch(() => ({}));
        const msg = errBody?.error?.message || resp.statusText;
        throw new Error(`Gemini image generation failed (${resp.status}): ${msg}`);
      }

      const data = await resp.json();
      const parts = data?.candidates?.[0]?.content?.parts ?? [];
      const imagePart = parts.find((p) => p.inlineData?.mimeType?.startsWith('image/'));
      if (!imagePart) {
        throw new Error('Gemini image response contained no image data');
      }

      const ext = imagePart.inlineData.mimeType.split('/')[1] || 'png';
      const filename = `img_${Date.now()}_${i}.${ext}`;
      const filepath = join(IMAGES_DIR, filename);
      writeFileSync(filepath, Buffer.from(imagePart.inlineData.data, 'base64'));
      return `/generated/${filename}`;
    });

    return Promise.all(calls);
  }

  // ── OpenAI (DALL-E 3) path ───────────────────────────────────
  try {
    const client = getClient();
    console.debug('[AI] generateImages (OpenAI DALL-E 3)', { count });

    const calls = Array.from({ length: count }, () =>
      client.images.generate({
        model: 'dall-e-3',
        prompt,
        size: '1024x1024',
        n: 1,
      }),
    );

    const results = await Promise.all(calls);
    return results.map((r) => {
      const item = r.data[0];
      if (item.url) return item.url;
      throw new Error('DALL-E response contained no URL');
    });
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
