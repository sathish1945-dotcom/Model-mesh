import crypto from 'crypto';
import type { Request, Response } from 'express';
import { db } from '../db.ts';
import { getAppUrl } from '../openrouter-oauth.ts';
import { connectorRegistry } from './registry.ts';
import { GoogleDriveConnector, GOOGLE_DRIVE_SCOPE } from './google-drive-connector.ts';

function base64UrlEncode(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function getGoogleClientId(): string {
  if (!process.env.GOOGLE_CLIENT_ID) throw new Error('GOOGLE_CLIENT_ID is required');
  return process.env.GOOGLE_CLIENT_ID;
}

function getDriveAppUrl(req: Request): string {
  if (process.env.NODE_ENV === 'production' && !process.env.APP_URL) {
    throw new Error('APP_URL is required for Google Drive OAuth in production');
  }
  const appUrl = getAppUrl(req);
  const url = new URL(appUrl);
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
    throw new Error('APP_URL must use HTTPS in production');
  }
  return url.origin;
}

/**
 * Initiates the Google OAuth authorization flow for Google Drive.
 * GET /api/integrations/google-drive/connect
 */
export async function handleGoogleDriveConnect(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const state = base64UrlEncode(crypto.randomBytes(24));
    const codeVerifier = base64UrlEncode(crypto.randomBytes(32));
    const codeChallenge = base64UrlEncode(crypto.createHash('sha256').update(codeVerifier).digest());

    // Save CSRF state and PKCE verifier linked to this user
    await db.saveOAuthState(state, codeVerifier, user.id);

    const appUrl = getDriveAppUrl(req);
    const redirectUri = `${appUrl}/api/integrations/google-drive/callback`;
    const clientId = getGoogleClientId();

    const scopes = `${GOOGLE_DRIVE_SCOPE} email profile openid`;

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes,
      access_type: 'offline',
      prompt: 'consent',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    // If client requested JSON (e.g. from popup opening logic), send URL
    if (req.headers.accept?.includes('application/json') || req.query.format === 'json') {
      return res.json({ url: authUrl, redirectUri });
    }

    // Otherwise redirect directly
    return res.redirect(authUrl);
  } catch (err: any) {
    console.error('[Google Drive OAuth] Connect initiation failed:', err);
    return res.status(500).json({ error: err.message || 'Failed to initiate Google Drive authorization' });
  }
}

/**
 * Handles callback from Google OAuth server after user consent.
 * GET /api/integrations/google-drive/callback
 */
export async function handleGoogleDriveCallback(req: Request, res: Response) {
  const { code, state, error, error_description } = req.query;

  const renderPopupResult = (success: boolean, message: string) => {
    const safeMessage = message.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
    const origin = getDriveAppUrl(req);
    const safePayload = JSON.stringify({ type: success ? 'GOOGLE_DRIVE_OAUTH_SUCCESS' : 'GOOGLE_DRIVE_OAUTH_ERROR', message }).replace(/</g, '\\u003c');
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>ModelMesh - Google Drive Authorization</title>
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
            <h2>${success ? 'Google Drive Connected' : 'Authorization Incomplete'}</h2>
            <p>${safeMessage}</p>
            <button class="btn" onclick="window.close()">Close Window</button>
          </div>
          <script>
            try {
              if (window.opener) {
                window.opener.postMessage(${safePayload}, ${JSON.stringify(origin)});
                setTimeout(() => window.close(), 1200);
              }
            } catch (e) {
              console.warn(e);
            }
          </script>
        </body>
      </html>
    `);
  };

  if (error) {
    return renderPopupResult(
      false,
      `Google authorization was cancelled or denied: ${error_description || error}`
    );
  }

  if (!code || !state || typeof code !== 'string' || typeof state !== 'string') {
    return renderPopupResult(false, 'Missing required authorization code or state token.');
  }

  // Validate and consume state atomically to prevent replay attacks
  const oauthState = await db.consumeOAuthState(state);
  if (!oauthState) {
    return renderPopupResult(
      false,
      'Invalid or expired authorization session. Please try connecting again from ModelMesh.'
    );
  }

  const userId = oauthState.user_id;
  const codeVerifier = oauthState.code_verifier;

  try {
    const appUrl = getDriveAppUrl(req);
    const redirectUri = `${appUrl}/api/integrations/google-drive/callback`;
    const clientId = getGoogleClientId();
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientSecret) return renderPopupResult(false, 'Google Drive OAuth is not configured on the server.');

    const tokenParams: Record<string, string> = {
      client_id: clientId,
      code,
      code_verifier: codeVerifier,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    };
    if (clientSecret) {
      tokenParams.client_secret = clientSecret;
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(tokenParams),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error('[Google Drive OAuth] Token exchange error:', errText);
      return renderPopupResult(false, `Google token exchange failed (${tokenRes.status}).`);
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in;

    // Connect via GoogleDriveConnector
    const connector = connectorRegistry.getConnector('google-drive') as GoogleDriveConnector;
    const connectResult = await connector.connect(userId, {
      accessToken,
      refreshToken,
      expiresIn,
      clientId,
      clientSecret,
    });

    if (!connectResult.success) {
      return renderPopupResult(false, connectResult.error || 'Failed to initialize Google Drive connection.');
    }

    return renderPopupResult(
      true,
      `Successfully connected Google Drive as ${connectResult.accountUsername || 'Google Account'}. You can now close this window.`
    );
  } catch (err: any) {
    console.error('[Google Drive OAuth] Callback handler exception:', err);
    return renderPopupResult(false, `Connection failed: ${err.message || 'Unknown error'}`);
  }
}
