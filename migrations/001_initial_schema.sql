-- ModelMesh Production Schema Migration 001
-- Defines primary entities, strict foreign key constraints with ON DELETE CASCADE, and performance indexes.

-- 1. Users Table
CREATE TABLE IF NOT EXISTS modelmesh_users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  password_hash TEXT,
  auth_provider TEXT DEFAULT 'email',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Provider Connections (Encrypted OpenRouter Credentials)
CREATE TABLE IF NOT EXISTS modelmesh_provider_connections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES modelmesh_users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  encrypted_credential TEXT,
  connection_status TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- Ensure foreign key constraint exists if table already existed prior to migration
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_provider_connections_user'
  ) THEN
    ALTER TABLE modelmesh_provider_connections
    DROP CONSTRAINT IF EXISTS modelmesh_provider_connections_user_id_fkey,
    ADD CONSTRAINT fk_provider_connections_user
    FOREIGN KEY (user_id) REFERENCES modelmesh_users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 3. Chat Threads
CREATE TABLE IF NOT EXISTS modelmesh_chats (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES modelmesh_users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_chats_user'
  ) THEN
    ALTER TABLE modelmesh_chats
    DROP CONSTRAINT IF EXISTS modelmesh_chats_user_id_fkey,
    ADD CONSTRAINT fk_chats_user
    FOREIGN KEY (user_id) REFERENCES modelmesh_users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 4. Messages
CREATE TABLE IF NOT EXISTS modelmesh_messages (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL REFERENCES modelmesh_chats(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  model_category TEXT,
  model_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_messages_chat'
  ) THEN
    ALTER TABLE modelmesh_messages
    DROP CONSTRAINT IF EXISTS modelmesh_messages_chat_id_fkey,
    ADD CONSTRAINT fk_messages_chat
    FOREIGN KEY (chat_id) REFERENCES modelmesh_chats(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 5. OAuth PKCE States (with expiry and consumed tracking)
CREATE TABLE IF NOT EXISTS modelmesh_oauth_states (
  state TEXT PRIMARY KEY,
  code_verifier TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES modelmesh_users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
  consumed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alter table safely if oauth_states existed previously without the columns
ALTER TABLE modelmesh_oauth_states
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
  ADD COLUMN IF NOT EXISTS consumed BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_oauth_states_user'
  ) THEN
    ALTER TABLE modelmesh_oauth_states
    DROP CONSTRAINT IF EXISTS modelmesh_oauth_states_user_id_fkey,
    ADD CONSTRAINT fk_oauth_states_user
    FOREIGN KEY (user_id) REFERENCES modelmesh_users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Indexes for frequent queries and joins
CREATE INDEX IF NOT EXISTS idx_provider_connections_user_id ON modelmesh_provider_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_chats_user_id ON modelmesh_chats(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON modelmesh_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON modelmesh_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_oauth_states_user_id ON modelmesh_oauth_states(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires_at ON modelmesh_oauth_states(expires_at);
