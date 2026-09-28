import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

/**
 * Loads environment configuration safely:
 * In production, process.env values take absolute precedence and cannot be overridden by .env files.
 * In development, if a system environment variable is set to an empty placeholder (e.g. '""' or ''),
 * an explicit local .env value is used.
 */
export function loadEnvironment(): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const envPath = path.resolve(process.cwd(), '.env');

  if (!fs.existsSync(envPath)) {
    return;
  }

  if (isProduction) {
    // In production, NEVER override any existing environment variables
    dotenv.config({ path: envPath, override: false });
    return;
  }

  // In development, parse .env and populate missing or empty-quoted variables
  try {
    const rawEnv = fs.readFileSync(envPath, 'utf-8');
    const parsed = dotenv.parse(rawEnv);
    for (const [key, val] of Object.entries(parsed)) {
      const current = process.env[key];
      if (current === undefined || current === '' || current === '""') {
        process.env[key] = val;
      }
    }
  } catch (err) {
    console.warn('[Env] Could not parse .env file:', err);
  }
}

/**
 * Returns clean database URL or undefined if not set
 */
export function getDatabaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url || typeof url !== 'string' || url.trim() === '' || url === '""') {
    return undefined;
  }
  return url.trim();
}
