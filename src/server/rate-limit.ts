import type { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const userPromptLimits = new Map<string, RateLimitRecord>();
const ipLimits = new Map<string, RateLimitRecord>();

// Maximum prompt size in characters (approx ~4k-5k tokens)
export const MAX_PROMPT_LENGTH = 16000;

// Chat prompts: 20 requests per minute per user
const CHAT_LIMIT_WINDOW_MS = 60 * 1000;
const CHAT_LIMIT_MAX_REQUESTS = 25;

// General API requests: 120 per minute per IP
const API_LIMIT_WINDOW_MS = 60 * 1000;
const API_LIMIT_MAX_REQUESTS = 150;

export function chatRateLimit(req: Request, res: Response, next: NextFunction) {
  const userId = (req as any).user?.id || req.ip || 'anonymous';
  const now = Date.now();
  let record = userPromptLimits.get(userId);

  if (!record || now > record.resetAt) {
    record = { count: 1, resetAt: now + CHAT_LIMIT_WINDOW_MS };
    userPromptLimits.set(userId, record);
    return next();
  }

  if (record.count >= CHAT_LIMIT_MAX_REQUESTS) {
    const retryAfter = Math.ceil((record.resetAt - now) / 1000);
    res.setHeader('Retry-After', retryAfter);
    return res.status(429).json({
      error: `Rate limit reached. Please wait ${retryAfter} seconds before sending another message.`,
    });
  }

  record.count++;
  next();
}

export function apiRateLimit(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || '127.0.0.1';
  const now = Date.now();
  let record = ipLimits.get(ip);

  if (!record || now > record.resetAt) {
    record = { count: 1, resetAt: now + API_LIMIT_WINDOW_MS };
    ipLimits.set(ip, record);
    return next();
  }

  if (record.count >= API_LIMIT_MAX_REQUESTS) {
    return res.status(429).json({
      error: 'Too many requests. Please slow down.',
    });
  }

  record.count++;
  next();
}

export function validatePrompt(prompt: unknown): { valid: boolean; error?: string; cleanPrompt?: string } {
  if (typeof prompt !== 'string') {
    return { valid: false, error: 'Prompt must be a string' };
  }
  const trimmed = prompt.trim();
  if (!trimmed) {
    return { valid: false, error: 'Prompt cannot be empty' };
  }
  if (trimmed.length > MAX_PROMPT_LENGTH) {
    return {
      valid: false,
      error: `Prompt exceeds maximum allowed length of ${MAX_PROMPT_LENGTH.toLocaleString()} characters.`,
    };
  }
  return { valid: true, cleanPrompt: trimmed };
}
