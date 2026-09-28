import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadEnvironment } from './src/server/env.ts';

// Load environment variables safely (never override production secrets)
loadEnvironment();

import { db } from './src/server/db.ts';
import {
  generateToken,
  setSessionCookie,
  clearSessionCookie,
  requireAuth,
  hashPassword,
  verifyPassword,
  getSessionFromRequest,
} from './src/server/auth.ts';
import {
  handleOpenRouterConnect,
  handleOpenRouterCallback,
  handleOpenRouterStatus,
  handleOpenRouterDisconnect,
  getAppUrl,
} from './src/server/openrouter-oauth.ts';
import { handleChatStream } from './src/server/chat-service.ts';
import { chatRateLimit, apiRateLimit } from './src/server/rate-limit.ts';
import { validateAndGetEncryptionKey } from './src/server/encryption.ts';

// Validate required APP_ENCRYPTION_KEY (Base64-encoded 32-byte key) on server startup
try {
  validateAndGetEncryptionKey();
  console.log('[Security] APP_ENCRYPTION_KEY validated: Base64-encoded 32-byte AES-GCM key confirmed.');
} catch (err: any) {
  console.error('[Security Startup Error]', err.message);
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Basic middleware
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(apiRateLimit);

// --- Public Config Endpoint (NO SECRETS) ---
app.get('/api/config', (req, res) => {
  res.json({
    appName: 'ModelMesh',
    appUrl: getAppUrl(req),
    hasGoogleClientId: Boolean(process.env.GOOGLE_CLIENT_ID),
    googleClientId: process.env.GOOGLE_CLIENT_ID || null,
  });
});

// --- Authentication Endpoints ---

// Register with email/password
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    if (typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Invalid email address' });
    }
    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existing = db.findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = await hashPassword(password);
    const user = db.createUser({
      email,
      name: (name && String(name).trim()) || email.split('@')[0],
      password_hash: passwordHash,
      auth_provider: 'email',
    });

    const token = generateToken(user);
    setSessionCookie(res, token);

    return res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        auth_provider: user.auth_provider,
        created_at: user.created_at,
      },
      token,
    });
  } catch (err) {
    console.error('[Auth] Registration error:', err);
    return res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// Login with email/password
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = db.findUserByEmail(email);
    if (!user || !user.password_hash) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const match = await verifyPassword(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken(user);
    setSessionCookie(res, token);

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        auth_provider: user.auth_provider,
        created_at: user.created_at,
      },
      token,
    });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    return res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// Google Sign-in / SSO
app.post('/api/auth/google', async (req, res) => {
  try {
    const { credential, email, name } = req.body;

    let userEmail = email;
    let userName = name;

    if (credential && typeof credential === 'string') {
      try {
        const parts = credential.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
          if (payload.email) {
            userEmail = payload.email;
            userName = payload.name || payload.given_name || userEmail.split('@')[0];
          }
        }
      } catch (err) {
        console.warn('[Google Auth] Could not decode JWT credential, checking provided profile:', err);
      }
    }

    if (!userEmail) {
      return res.status(400).json({ error: 'Valid Google email is required for Google sign in' });
    }

    let user = db.findUserByEmail(userEmail);
    if (!user) {
      user = db.createUser({
        email: userEmail,
        name: userName || userEmail.split('@')[0],
        auth_provider: 'google',
      });
    }

    const token = generateToken(user);
    setSessionCookie(res, token);

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        auth_provider: user.auth_provider,
        created_at: user.created_at,
      },
      token,
    });
  } catch (err) {
    console.error('[Google Auth] Sign in error:', err);
    return res.status(500).json({ error: 'Google sign in failed' });
  }
});

// Get current logged-in user
app.get('/api/auth/me', (req, res) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.json({ user: null });
  }
  const user = db.findUserById(session.userId);
  if (!user) {
    clearSessionCookie(res);
    return res.json({ user: null });
  }
  return res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      auth_provider: user.auth_provider,
      created_at: user.created_at,
    },
  });
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  clearSessionCookie(res);
  return res.json({ success: true, message: 'Logged out successfully' });
});

// --- OpenRouter OAuth Routes ---
app.get('/api/openrouter/connect', requireAuth, handleOpenRouterConnect);
app.get(['/api/openrouter/callback', '/api/openrouter/callback/'], handleOpenRouterCallback);
app.get('/api/openrouter/status', requireAuth, handleOpenRouterStatus);
app.post('/api/openrouter/disconnect', requireAuth, handleOpenRouterDisconnect);

// --- Chat History Routes ---
app.get('/api/chats', requireAuth, (req, res) => {
  const user = (req as any).user;
  const chats = db.getUserChats(user.id);
  res.json({ chats });
});

app.post('/api/chats', requireAuth, (req, res) => {
  const user = (req as any).user;
  const title = (req.body.title && String(req.body.title).trim()) || 'New Chat';
  const chat = db.createChat(user.id, title);
  res.status(201).json({ chat });
});

app.get('/api/chats/:id', requireAuth, (req, res) => {
  const user = (req as any).user;
  const chat = db.getChatById(req.params.id, user.id);
  if (!chat) {
    return res.status(404).json({ error: 'Chat not found' });
  }
  const messages = db.getChatMessages(chat.id);
  res.json({ chat, messages });
});

app.delete('/api/chats/:id', requireAuth, (req, res) => {
  const user = (req as any).user;
  const success = db.deleteChat(req.params.id, user.id);
  if (!success) {
    return res.status(404).json({ error: 'Chat not found' });
  }
  res.json({ success: true });
});

// --- Streaming Chat Route ---
app.post('/api/chat', requireAuth, chatRateLimit, handleChatStream);

// --- Setup Vite or Static File Serving ---
async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[ModelMesh Server] Running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[ModelMesh Server] Fatal startup error:', err);
  process.exit(1);
});
