/**
 * routes/instagram.js — Instagram Business Login OAuth + Publishing
 * ──────────────────────────────────────────────────────────────────
 *
 * ┌─ META APP SETUP (do this manually at developers.facebook.com) ─┐
 * │                                                                  │
 * │  1. Create a new app — App type: Business                        │
 * │  2. Add product: "Instagram Graph API"                           │
 * │     (NOT "Facebook Login for Instagram" — that's the old flow)   │
 * │  3. In App Settings → Instagram → OAuth Settings, add:          │
 * │       Valid OAuth Redirect URIs:                                 │
 * │         http://localhost:5001/api/instagram/callback             │
 * │  4. Copy App ID → INSTAGRAM_APP_ID in .env                      │
 * │     Copy App Secret → INSTAGRAM_APP_SECRET in .env              │
 * │                                                                  │
 * │  ⚠️  DEVELOPMENT MODE LIMITATION                                 │
 * │  The app starts in Development mode. Only Instagram Business or  │
 * │  Creator accounts that are explicitly added as Testers or        │
 * │  Developers in the Meta app dashboard can complete the OAuth     │
 * │  flow. Arbitrary users cannot connect their accounts until Meta  │
 * │  App Review is approved (submit under "instagram_business_basic" │
 * │  and "instagram_business_content_publish" permissions).          │
 * │  Do NOT expect this to work for real customers before review.    │
 * │                                                                  │
 * └──────────────────────────────────────────────────────────────────┘
 *
 * Token refresh note (implement later with n8n / scheduled job):
 *   Long-lived tokens expire after 60 days. Before expiry, refresh via:
 *     GET https://graph.instagram.com/refresh_access_token
 *       ?grant_type=ig_refresh_token
 *       &access_token=<current_long_lived_token>
 *   Schedule this job to run ~every 50 days per connected user.
 *   This is NOT built in this pass — it will be wired into the n8n
 *   automation pipeline in a future phase.
 */

import { createHmac, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import express from 'express';

const router = express.Router();

// ── Config ───────────────────────────────────────────────────────

const {
  INSTAGRAM_APP_ID,
  INSTAGRAM_APP_SECRET,
  INSTAGRAM_REDIRECT_URI,
  TOKEN_ENCRYPTION_KEY,
  HMAC_SECRET,
} = process.env;

// Warn loudly on startup if Instagram vars are missing — the routes will
// return clear 503s rather than cryptic crashes.
const igConfigured =
  INSTAGRAM_APP_ID && INSTAGRAM_APP_SECRET && INSTAGRAM_REDIRECT_URI;
const encryptionReady =
  TOKEN_ENCRYPTION_KEY && TOKEN_ENCRYPTION_KEY.length === 64;

if (!igConfigured) {
  console.warn('⚠️  Instagram OAuth not configured — set INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, INSTAGRAM_REDIRECT_URI in .env');
}
if (TOKEN_ENCRYPTION_KEY && TOKEN_ENCRYPTION_KEY.length !== 64) {
  console.warn('⚠️  TOKEN_ENCRYPTION_KEY must be exactly 64 hex chars (32 bytes). Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
}
if (!HMAC_SECRET) {
  console.warn('⚠️  HMAC_SECRET is not set — OAuth state signing disabled. Set HMAC_SECRET in .env');
}

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Sign a userId into a tamper-proof state string.
 * Format: "<userId>.<hmac-hex>"
 */
function signState(userId) {
  const secret = HMAC_SECRET || 'dev-hmac-secret-change-me';
  const sig = createHmac('sha256', secret).update(userId).digest('hex');
  return Buffer.from(`${userId}.${sig}`).toString('base64url');
}

/**
 * Verify the state string. Returns userId on success, null on failure.
 */
function verifyState(state) {
  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf8');
    const lastDot = decoded.lastIndexOf('.');
    if (lastDot === -1) return null;
    const userId = decoded.slice(0, lastDot);
    const sig = decoded.slice(lastDot + 1);
    const expected = createHmac('sha256', HMAC_SECRET || 'dev-hmac-secret-change-me')
      .update(userId)
      .digest('hex');
    // Constant-time comparison to prevent timing attacks
    if (sig.length !== expected.length) return null;
    let mismatch = 0;
    for (let i = 0; i < sig.length; i++) {
      mismatch |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
    }
    return mismatch === 0 ? userId : null;
  } catch {
    return null;
  }
}

/**
 * Encrypt a plaintext string using AES-256-CBC.
 * Returns "<iv-hex>:<ciphertext-hex>".
 */
function encryptToken(plaintext) {
  if (!encryptionReady) {
    // Graceful degradation in dev if key not set — store with a clear prefix
    // so we know it's unencrypted and can detect it later.
    console.warn('⚠️  TOKEN_ENCRYPTION_KEY not set — storing token unencrypted (dev only)');
    return `unencrypted:${plaintext}`;
  }
  const key = Buffer.from(TOKEN_ENCRYPTION_KEY, 'hex');
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt a token encrypted by encryptToken().
 */
function decryptToken(ciphertext) {
  if (ciphertext.startsWith('unencrypted:')) {
    return ciphertext.slice('unencrypted:'.length);
  }
  if (!encryptionReady) {
    throw new Error('TOKEN_ENCRYPTION_KEY is not configured — cannot decrypt token');
  }
  const [ivHex, encHex] = ciphertext.split(':');
  const key = Buffer.from(TOKEN_ENCRYPTION_KEY, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = createDecipheriv('aes-256-cbc', key, iv);
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encHex, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

/**
 * Simple auth middleware — reads x-user-id header.
 * Consistent with existing auth-TODO pattern in server.js.
 * Replace with real JWT/session middleware when auth is added.
 */
function requireUserId(req, res, next) {
  const userId = req.headers['x-user-id'] || req.query.userId;
  if (!userId) {
    return res.status(401).json({ error: 'x-user-id header (or userId query param) is required' });
  }
  req.userId = userId;
  next();
}

/**
 * Check if Instagram OAuth is configured; return 503 if not.
 */
function requireIgConfig(req, res, next) {
  if (!igConfigured) {
    return res.status(503).json({
      error: 'Instagram OAuth is not configured on this server. Set INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, INSTAGRAM_REDIRECT_URI in .env',
    });
  }
  next();
}

// ── GET /api/instagram/connect ───────────────────────────────────
// Redirects user to Instagram's OAuth authorization page.
// Since we have no session yet, userId is passed as a query param and
// embedded in the signed state.

router.get('/api/instagram/connect', requireUserId, requireIgConfig, (req, res) => {
  const state = signState(req.userId);

  const params = new URLSearchParams({
    client_id: INSTAGRAM_APP_ID,
    redirect_uri: INSTAGRAM_REDIRECT_URI,
    scope: 'instagram_business_basic,instagram_business_content_publish',
    response_type: 'code',
    state,
  });

  const authUrl = `https://api.instagram.com/oauth/authorize?${params.toString()}`;
  res.redirect(authUrl);
});

// ── GET /api/instagram/callback ──────────────────────────────────
// Instagram redirects here with ?code=...&state=...
// Exchanges code for tokens, fetches account info, saves to MongoDB.

router.get('/api/instagram/callback', requireIgConfig, async (req, res) => {
  const FRONTEND_BASE = process.env.FRONTEND_URL || 'http://localhost:5173';
  const successUrl = `${FRONTEND_BASE}?ig_connected=true`;
  const errorUrl = `${FRONTEND_BASE}?ig_error=true`;

  const { code, state, error: igError, error_description } = req.query;

  // Instagram sends error= if the user denied permission
  if (igError) {
    console.error('Instagram OAuth denied:', igError, error_description);
    return res.redirect(`${errorUrl}&reason=${encodeURIComponent(igError)}`);
  }

  if (!code || !state) {
    return res.redirect(`${errorUrl}&reason=missing_code_or_state`);
  }

  // 1. Verify state signature
  const userId = verifyState(state);
  if (!userId) {
    console.error('Instagram callback: invalid state signature');
    return res.redirect(`${errorUrl}&reason=invalid_state`);
  }

  const { User } = req.app.locals;

  try {
    // 2. Exchange code for short-lived token
    const tokenParams = new URLSearchParams({
      client_id: INSTAGRAM_APP_ID,
      client_secret: INSTAGRAM_APP_SECRET,
      grant_type: 'authorization_code',
      redirect_uri: INSTAGRAM_REDIRECT_URI,
      code,
    });

    const shortTokenRes = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString(),
    });

    if (!shortTokenRes.ok) {
      const err = await shortTokenRes.json().catch(() => ({}));
      throw new Error(`Short-lived token exchange failed: ${err.error_message || shortTokenRes.status}`);
    }

    const { access_token: shortToken } = await shortTokenRes.json();

    // 3. Exchange short-lived token for long-lived token (60-day)
    const longTokenParams = new URLSearchParams({
      grant_type: 'ig_exchange_token',
      client_secret: INSTAGRAM_APP_SECRET,
      access_token: shortToken,
    });

    const longTokenRes = await fetch(
      `https://graph.instagram.com/access_token?${longTokenParams.toString()}`,
    );

    if (!longTokenRes.ok) {
      const err = await longTokenRes.json().catch(() => ({}));
      throw new Error(`Long-lived token exchange failed: ${err.error?.message || longTokenRes.status}`);
    }

    const { access_token: longToken, expires_in: expiresIn } = await longTokenRes.json();
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

    // 4. Fetch Instagram Business account info (id + username)
    const meRes = await fetch(
      `https://graph.instagram.com/me?fields=id,username&access_token=${longToken}`,
    );

    if (!meRes.ok) {
      const err = await meRes.json().catch(() => ({}));
      throw new Error(`Failed to fetch IG account info: ${err.error?.message || meRes.status}`);
    }

    const { id: igBusinessId, username } = await meRes.json();

    // 5. Encrypt the token and save to MongoDB
    const encryptedToken = encryptToken(longToken);

    await User.findOneAndUpdate(
      { userId },
      {
        igAccount: {
          igBusinessId,
          username,
          accessToken: encryptedToken,
          tokenExpiresAt,
        },
      },
      { upsert: true, new: true, runValidators: true },
    );

    console.log(`✅ Instagram connected: @${username} for user ${userId}`);
    res.redirect(successUrl);
  } catch (err) {
    console.error('Instagram callback error:', err.message);
    res.redirect(`${errorUrl}&reason=${encodeURIComponent(err.message)}`);
  }
});

// ── GET /api/instagram/status ────────────────────────────────────
// Returns whether the user has a connected, non-expired Instagram account.

router.get('/api/instagram/status', requireUserId, async (req, res) => {
  const { User } = req.app.locals;

  try {
    const user = await User.findOne({ userId: req.userId }).lean();
    const ig = user?.igAccount;

    if (!ig?.accessToken || !ig?.igBusinessId) {
      return res.json({ connected: false });
    }

    const expired = ig.tokenExpiresAt && new Date(ig.tokenExpiresAt) < new Date();
    if (expired) {
      return res.json({ connected: false, reason: 'token_expired', expiredAt: ig.tokenExpiresAt });
    }

    res.json({
      connected: true,
      username: ig.username,
      igBusinessId: ig.igBusinessId,
      tokenExpiresAt: ig.tokenExpiresAt,
    });
  } catch (err) {
    console.error('/api/instagram/status error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/instagram/publish ──────────────────────────────────
// Two-step publish: create media container → publish container.
// Body: { imageUrl, caption }

router.post('/api/instagram/publish', requireUserId, async (req, res) => {
  const { imageUrl, caption } = req.body;
  if (!imageUrl) return res.status(400).json({ error: 'imageUrl is required' });
  if (!caption) return res.status(400).json({ error: 'caption is required' });

  const { User, Post } = req.app.locals;

  try {
    // 1. Load user and check connection
    const user = await User.findOne({ userId: req.userId });
    const ig = user?.igAccount;

    if (!ig?.accessToken || !ig?.igBusinessId) {
      return res.status(403).json({ error: 'Instagram account not connected. Complete the OAuth flow first.' });
    }

    // 2. Check token expiry — do not attempt publish with a dead token
    if (ig.tokenExpiresAt && new Date(ig.tokenExpiresAt) < new Date()) {
      return res.status(403).json({
        error: 'Instagram access token has expired. Please reconnect your Instagram account.',
        code: 'token_expired',
      });
    }

    // 3. Decrypt the stored access token
    let accessToken;
    try {
      accessToken = decryptToken(ig.accessToken);
    } catch (err) {
      return res.status(500).json({ error: `Failed to decrypt access token: ${err.message}` });
    }

    const igId = ig.igBusinessId;

    // 4. Step 1: Create media container
    const containerParams = new URLSearchParams({
      image_url: imageUrl,
      caption,
      access_token: accessToken,
    });

    const containerRes = await fetch(
      `https://graph.instagram.com/v21.0/${igId}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: containerParams.toString(),
      },
    );

    const containerData = await containerRes.json();

    if (!containerRes.ok || !containerData.id) {
      const igErr = containerData.error;
      // Surface Instagram-specific errors clearly
      if (igErr?.code === 9004) {
        return res.status(422).json({ error: 'Image URL must be publicly accessible (Instagram cannot fetch private/localhost URLs)', code: 'unreachable_url' });
      }
      if (igErr?.code === 36000 || igErr?.type === 'OAuthException') {
        return res.status(403).json({ error: 'Instagram auth error — token may be invalid. Reconnect your account.', code: 'auth_error' });
      }
      if (igErr?.code === 4 || igErr?.code === 32) {
        return res.status(429).json({ error: 'Instagram rate limit hit. Try again in a few minutes.', code: 'rate_limited' });
      }
      return res.status(422).json({ error: igErr?.message || 'Failed to create media container', code: igErr?.code });
    }

    const containerId = containerData.id;

    // Brief pause — Instagram recommends waiting before publishing
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 5. Step 2: Publish the container
    const publishParams = new URLSearchParams({
      creation_id: containerId,
      access_token: accessToken,
    });

    const publishRes = await fetch(
      `https://graph.instagram.com/v21.0/${igId}/media_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: publishParams.toString(),
      },
    );

    const publishData = await publishRes.json();

    if (!publishRes.ok || !publishData.id) {
      const igErr = publishData.error;
      if (igErr?.code === 9007) {
        return res.status(422).json({ error: 'Media container is not ready yet. Try publishing again in a moment.', code: 'container_not_ready' });
      }
      return res.status(422).json({ error: igErr?.message || 'Failed to publish media', code: igErr?.code });
    }

    // 6. Save post record to MongoDB
    const post = await Post.create({
      userId: req.userId,
      imageUrl,
      caption,
      status: 'posted',
      postedAt: new Date(),
    });

    console.log(`📸 Published to Instagram @${ig.username}: ${publishData.id}`);
    res.json({
      success: true,
      igPostId: publishData.id,
      postId: post._id,
      username: ig.username,
    });
  } catch (err) {
    console.error('/api/instagram/publish error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
