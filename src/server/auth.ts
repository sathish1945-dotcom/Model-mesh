import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import type { Request, Response, NextFunction } from 'express';
import { db, type DBUser } from './db.ts';

function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[Security] AUTH_SECRET environment variable is required in production.');
    }
    return 'modelmesh-auth-secret-default-key-32b';
  }
  return secret;
}

const COOKIE_NAME = 'modelmesh_session';

export interface AuthSession {
  userId: string;
  email: string;
  exp: number;
}

export function generateToken(user: DBUser): string {
  const secret = getAuthSecret();
  const payload: AuthSession = {
    userId: user.id,
    email: user.email,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${signature}`;
}

export function verifyToken(token: string): AuthSession | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [body, signature] = parts;
    const secret = getAuthSecret();
    const expectedSignature = crypto.createHmac('sha256', secret).update(body).digest('base64url');

    if (
      !crypto.timingSafeEqual(
        Buffer.from(signature, 'utf8'),
        Buffer.from(expectedSignature, 'utf8')
      )
    ) {
      return null;
    }

    const payload: AuthSession = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (Date.now() > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function setSessionCookie(res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',      // HTTPS in production
    sameSite: 'lax',  // Same-origin application
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
}

export function getSessionFromRequest(req: Request): AuthSession | null {
  // Check cookie first
  let token = req.cookies?.[COOKIE_NAME];
  // Check Authorization Bearer header as fallback
  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.substring(7).trim();
  }
  if (!token) return null;
  return verifyToken(token);
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  let user;
  try { user = await db.findUserById(session.userId); } catch (error) { return next(error); }
  if (!user) {
    return res.status(401).json({ error: 'User not found or deleted' });
  }
  (req as any).user = user;
  next();
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
