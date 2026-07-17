/**
 * scrapeSite(url) — Static-HTML scraper
 *
 * NOTE: This is a plain fetch + cheerio scraper. It does NOT execute
 * JavaScript, so JS-rendered SPAs (React, Next, Angular, etc.) will
 * return minimal or empty content. That is expected for now — a future
 * upgrade could add a headless browser fallback.
 */

import * as cheerio from 'cheerio';

/**
 * @param {string} url — The website URL to scrape.
 * @returns {Promise<{ ok: true, data: object } | { ok: false, error: string }>}
 */
export async function scrapeSite(url) {
  // ── Validate URL ────────────────────────────────────────────────
  let parsed;
  try {
    parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
  } catch {
    return { ok: false, error: `Invalid URL: "${url}"` };
  }

  // ── Fetch with timeout ──────────────────────────────────────────
  let res;
  try {
    res = await fetch(parsed.href, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000), // 8-second timeout
    });
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return { ok: false, error: `Request timed out after 8 seconds for ${parsed.href}` };
    }
    return { ok: false, error: `Fetch failed: ${err.message}` };
  }

  if (!res.ok) {
    return { ok: false, error: `Non-200 response: ${res.status} ${res.statusText}` };
  }

  // ── Parse HTML ──────────────────────────────────────────────────
  const html = await res.text();
  const $ = cheerio.load(html);

  // Remove script/style/noscript to keep only visible text
  $('script, style, noscript, svg').remove();

  // Title
  const title = $('title').first().text().trim() || null;

  // Meta description
  const metaDescription =
    $('meta[name="description"]').attr('content')?.trim() ||
    $('meta[property="og:description"]').attr('content')?.trim() ||
    null;

  // Headings (h1, h2, h3)
  const headings = [];
  $('h1, h2, h3').each((_i, el) => {
    const text = $(el).text().trim();
    if (text) headings.push(text);
  });

  // Paragraph text (truncated to ~3000 chars total)
  let paragraphText = '';
  $('p').each((_i, el) => {
    if (paragraphText.length >= 3000) return false; // stop iterating
    const text = $(el).text().trim();
    if (text) {
      paragraphText += text + '\n';
    }
  });
  paragraphText = paragraphText.slice(0, 3000).trim();

  // Logo / og:image
  const images = [];
  const ogImage = $('meta[property="og:image"]').attr('content')?.trim();
  if (ogImage) images.push(ogImage);

  // Look for logo-like images in header/nav
  $('header img, nav img').each((_i, el) => {
    const src = $(el).attr('src')?.trim();
    if (src && images.length < 5) {
      // Resolve relative URLs
      try {
        images.push(new URL(src, parsed.origin).href);
      } catch {
        images.push(src);
      }
    }
  });

  return {
    ok: true,
    data: {
      url: parsed.href,
      title,
      metaDescription,
      headings,
      paragraphText,
      images,
    },
  };
}
