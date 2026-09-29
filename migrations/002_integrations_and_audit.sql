-- ModelMesh Integrations & Audit Logs Migration 002
-- Extends provider connections with provider account and metadata, and creates audit log table.

-- 1. Extend provider connections safely
ALTER TABLE modelmesh_provider_connections
  ADD COLUMN IF NOT EXISTS provider_account_id TEXT,
  ADD COLUMN IF NOT EXISTS account_username TEXT,
  ADD COLUMN IF NOT EXISTS scopes TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB;

-- 2. Audit Logs Table (Never logs tokens, secrets, or passwords)
CREATE TABLE IF NOT EXISTS modelmesh_audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES modelmesh_users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  action TEXT NOT NULL,
  resource TEXT,
  permission_level TEXT NOT NULL, -- 'READ' | 'WRITE' | 'DANGEROUS'
  status TEXT NOT NULL,           -- 'success' | 'failed' | 'denied' | 'pending_confirmation'
  approval_status TEXT,          -- 'auto_approved' | 'user_confirmed' | 'rejected'
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Foreign key check
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_audit_logs_user'
  ) THEN
    ALTER TABLE modelmesh_audit_logs
    ADD CONSTRAINT fk_audit_logs_user
    FOREIGN KEY (user_id) REFERENCES modelmesh_users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON modelmesh_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON modelmesh_audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_provider ON modelmesh_audit_logs(provider);
