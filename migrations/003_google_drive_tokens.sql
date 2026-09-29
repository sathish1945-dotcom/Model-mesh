-- ModelMesh Migration 003: Google Drive & Token Expiry
-- Adds encrypted refresh token and token expiry to modelmesh_provider_connections

ALTER TABLE modelmesh_provider_connections
  ADD COLUMN IF NOT EXISTS encrypted_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS token_expiry TIMESTAMPTZ;
