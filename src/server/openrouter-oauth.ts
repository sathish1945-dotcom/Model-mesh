import crypto from 'crypto';
import type { Request, Response } from 'express';
import { db } from './db.ts';
import { encryptCredential } from './encryption.ts';

function base64UrlEncode(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Generates a secure random code_verifier (32 random bytes, base64url-encoded).
 */
function generateCodeVerifier(): string {
  return base64UrlEncode(crypto.randomBytes(32));
}

/**
 * Generates an S256 code_challenge: SHA-256 hash of code_verifier, base64url-encoded.
 */
function generateCodeChallenge(verifier: string): string {
  const hash = crypto.createHash('sha256').update(verifier).digest();
  return base64UrlEncode(hash);
}

export function getAppUrl(req: Request): string {
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/+$/, '');
  }
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:3000';
  return `${protocol}://${host}`;
}

/**
 * Generates OpenRouter official PKCE authorization URL:
 * Redirect user to https://openrouter.ai/auth with:
 * - callback_url
 * - code_challenge
 * - code_challenge_method=S256
 * Note: OpenRouter PKCE does NOT require client_id or client_secret.
 * GET /api/openrouter/connect
 */
export async function handleOpenRouterConnect(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const state = base64UrlEncode(crypto.randomBytes(24));
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    // Persist state + code_verifier securely on the backend linked to the user
    await db.saveOAuthState(state, codeVerifier, user.id);

    const appUrl = getAppUrl(req);
    const callbackUrl = `${appUrl}/api/openrouter/callback`;

    const params = new URLSearchParams({
      callback_url: callbackUrl,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state,
    });

    const authUrl = `https://openrouter.ai/auth?${params.toString()}`;

    return res.json({
      url: authUrl,
      callbackUrl,
    });
  } catch (err: any) {
    console.error('[OpenRouter OAuth] Failed to generate connect URL:', err);
    return res.status(500).json({ error: 'Failed to initiate OpenRouter authorization' });
  }
}

/**
 * Handles callback from OpenRouter after user authorizes:
 * Receive authorization code on the callback.
 * Exchange code + code_verifier at https://openrouter.ai/api/v1/auth/keys.
 * Receive user's OpenRouter API key.
 * Encrypt the key server-side using AES-256-GCM.
 * Store the encrypted key in the database linked only to that user.
 * GET /api/openrouter/callback
 */
export async function handleOpenRouterCallback(req: Request, res: Response) {
  const { code, state, error, error_description } = req.query;

  const renderResponse = (success: boolean, message: string) => {
    const origin = new URL(getAppUrl(req)).origin;
    const safeMessage = message.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
    const payload = JSON.stringify({ type: success ? 'OAUTH_AUTH_SUCCESS' : 'OAUTH_AUTH_ERROR', provider: 'openrouter', error: success ? null : message }).replace(/</g, '\\u003c');
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>ModelMesh - OpenRouter Connection</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              background-color: #09090b;
              color: #f4f4f5;
            }
            .card {
              max-width: 420px;
              text-align: center;
              padding: 32px 24px;
              background: #18181b;
              border: 1px solid #27272a;
              border-radius: 12px;
            }
            h2 { margin-top: 0; font-size: 1.25rem; }
            p { font-size: 0.9rem; color: #a1a1aa; line-height: 1.5; }
            .btn {
              margin-top: 16px;
              display: inline-block;
              background: #2563eb;
              color: #fff;
              padding: 8px 16px;
              border-radius: 6px;
              text-decoration: none;
              font-size: 0.875rem;
              cursor: pointer;
              border: none;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>${success ? 'Connected Successfully' : 'Connection Incomplete'}</h2>
            <p>${safeMessage}</p>
            <script>
              try {
                if (window.opener) {
                  window.opener.postMessage(${payload}, ${JSON.stringify(origin)});
                  setTimeout(() => window.close(), 1200);
                }
              } catch (e) {
                console.error(e);
              }
            </script>
            <button class="btn" onclick="window.close()">Close Window</button>
            <a class="btn" href="${origin}">Return to ModelMesh</a>
          </div>
        </body>
      </html>
    `);
  };

  if (error || error_description) {
    console.warn('[OpenRouter OAuth] Error from callback:', error, error_description);
    return renderResponse(false, 'Authorization was cancelled or rejected by the provider.');
  }

  if (!code || typeof code !== 'string' || !state || typeof state !== 'string') {
    return renderResponse(false, 'Missing required authorization code or state parameters.');
  }

  // Verify and consume state
  const oauthState = await db.consumeOAuthState(state);
  if (!oauthState) {
    return renderResponse(false, 'Authorization session expired or was invalid. Please try connecting again.');
  }

  try {
    // Official OpenRouter PKCE exchange:
    // POST https://openrouter.ai/api/v1/auth/keys with { code, code_verifier, code_challenge_method: "S256" }
    const exchangeBody: Record<string, string> = {
      code,
      code_verifier: oauthState.code_verifier,
      code_challenge_method: 'S256',
    };

    const exchangeRes = await fetch('https://openrouter.ai/api/v1/auth/keys', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ModelMesh/1.0',
      },
      body: JSON.stringify(exchangeBody),
    });

    if (!exchangeRes.ok) {
      const errText = await exchangeRes.text();
      console.error('[OpenRouter OAuth] Key exchange failed with status', exchangeRes.status, errText);
      return renderResponse(false, 'Failed to exchange authorization code with OpenRouter. Please try again.');
    }

    const data = (await exchangeRes.json()) as { key?: string };
    if (!data.key || typeof data.key !== 'string') {
      return renderResponse(false, 'OpenRouter did not return a valid key.');
    }

    // Encrypt the received key server-side using AES-256-GCM
    const encryptedKey = encryptCredential(data.key);

    // Store the encrypted key in the database linked only to that user
    await db.saveProviderConnection(oauthState.user_id, 'openrouter', encryptedKey, 'connected');

    return renderResponse(
      true,
      'Your OpenRouter account has been connected securely. This popup will close automatically.'
    );
  } catch (err: any) {
    console.error('[OpenRouter OAuth] Error during key exchange or encryption:', err);
    return renderResponse(false, 'An unexpected error occurred during connection. Please retry.');
  }
}

/**
 * Returns connection status for current user (never exposes decrypted or raw keys)
 * GET /api/openrouter/status
 */
export async function handleOpenRouterStatus(req: Request, res: Response) {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const conn = await db.getProviderConnection(user.id, 'openrouter');
  return res.json({
    connected: !!conn && conn.connection_status === 'connected',
    provider: 'openrouter',
    mode: 'free_only',
    updatedAt: conn?.updated_at || null,
  });
}

/**
 * Disconnects OpenRouter credential for current user
 * POST /api/openrouter/disconnect
 */
export async function handleOpenRouterDisconnect(req: Request, res: Response) {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const success = await db.disconnectProvider(user.id, 'openrouter');
  return res.json({
    success,
    connected: false,
    message: 'OpenRouter account disconnected.',
  });
}
