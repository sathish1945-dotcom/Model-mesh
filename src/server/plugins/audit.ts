import { db } from '../db.ts';
import type { IntegrationProvider, PermissionLevel, AuditLogEntry } from '../../types/index.ts';

// Keys that must NEVER be logged to audit entries
const REDACTED_KEYS = new Set([
  'token',
  'access_token',
  'refresh_token',
  'secret',
  'api_key',
  'apikey',
  'password',
  'authorization',
  'credential',
  'credentials',
  'private_key',
  'service_role',
]);

/**
 * Recursively redacts sensitive keys from audit log parameter objects.
 */
export function sanitizeAuditDetails(details?: Record<string, any>): Record<string, any> | undefined {
  if (!details || typeof details !== 'object') return undefined;

  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(details)) {
    const lowerKey = key.toLowerCase();
    if (REDACTED_KEYS.has(lowerKey) || lowerKey.includes('token') || lowerKey.includes('secret') || lowerKey.includes('password')) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        sanitized[key] = value.map((item) =>
          typeof item === 'object' && item !== null ? sanitizeAuditDetails(item) : item
        );
      } else {
        sanitized[key] = sanitizeAuditDetails(value);
      }
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

export function recordAuditLog(params: {
  userId: string;
  provider: IntegrationProvider;
  action: string;
  resource?: string;
  permissionLevel: PermissionLevel;
  status: 'success' | 'failed' | 'denied' | 'pending_confirmation';
  approvalStatus?: 'auto_approved' | 'user_confirmed' | 'rejected';
  details?: Record<string, any>;
}): AuditLogEntry {
  const safeDetails = sanitizeAuditDetails(params.details);

  return db.createAuditLog({
    user_id: params.userId,
    provider: params.provider,
    action: params.action,
    resource: params.resource,
    permission_level: params.permissionLevel,
    status: params.status,
    approval_status: params.approvalStatus,
    details: safeDetails,
  });
}
