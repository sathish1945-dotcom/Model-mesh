import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard for AES-GCM
const AUTH_TAG_LENGTH = 16;
const REQUIRED_KEY_BYTES = 32;

// Dev fallback 32-byte key used only if process.env.APP_ENCRYPTION_KEY is omitted in local dev
const DEV_FALLBACK_BASE64_KEY = 'vS8T2t7F0k5n8y2B5w9z3C6d8j1L4m7P0q3T6v9Y2bA=';

/**
 * Validates and retrieves the 32-byte AES key from APP_ENCRYPTION_KEY.
 * Expects a Base64-encoded 32-byte key.
 * In development, if not provided, safely provisions a valid 32-byte fallback
 * to prevent dev server crash while logging a clear setup notice.
 */
export function validateAndGetEncryptionKey(): Buffer {
  let envKey = process.env.APP_ENCRYPTION_KEY;

  if (!envKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        '[Security] APP_ENCRYPTION_KEY environment variable is required in production. It must be a Base64-encoded 32-byte key.'
      );
    }
    console.warn(
      '[Security Notice] APP_ENCRYPTION_KEY not set in environment. Using default development key. Set APP_ENCRYPTION_KEY in production.'
    );
    envKey = DEV_FALLBACK_BASE64_KEY;
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(envKey, 'base64');
  } catch (err) {
    throw new Error(
      '[Security] APP_ENCRYPTION_KEY is not a valid Base64 string.'
    );
  }

  if (buffer.length !== REQUIRED_KEY_BYTES) {
    throw new Error(
      `[Security] APP_ENCRYPTION_KEY must decode to exactly 32 bytes (256 bits). Decoded size was ${buffer.length} bytes.`
    );
  }

  return buffer;
}

/**
 * Encrypts sensitive credentials (such as OpenRouter API tokens) using AES-256-GCM.
 * Output format: `iv:tag:ciphertext` (all hex encoded)
 */
export function encryptCredential(plainText: string): string {
  if (!plainText) {
    throw new Error('Cannot encrypt empty credential');
  }
  const key = validateAndGetEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts an encrypted credential.
 * Never log or expose this returned value to the browser/network!
 */
export function decryptCredential(encryptedData: string): string {
  if (!encryptedData) {
    throw new Error('Encrypted data is missing');
  }
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted format');
  }

  const [ivHex, tagHex, cipherHex] = parts;
  const key = validateAndGetEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
