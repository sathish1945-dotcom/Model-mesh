import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import pg from 'pg';
import { getDatabaseUrl } from './env.ts';
import type { User, ProviderConnection, Chat, ChatMessage } from '../types/index.ts';

const { Pool } = pg;

export interface DBUser extends User {
  password_hash?: string;
}

export interface DBProviderConnection extends ProviderConnection {
  encrypted_credential?: string;
}

export interface DBOAuthState {
  state: string;
  code_verifier: string;
  user_id: string;
  expires_at: string;
  consumed: boolean;
  created_at: string;
}

interface DatabaseSchema {
  users: DBUser[];
  provider_connections: DBProviderConnection[];
  chats: Chat[];
  messages: ChatMessage[];
  oauth_states: DBOAuthState[];
}

const DB_FALLBACK_FILE = path.resolve(process.cwd(), 'data/modelmesh_db.json');

class Database {
  private data: DatabaseSchema = {
    users: [],
    provider_connections: [],
    chats: [],
    messages: [],
    oauth_states: [],
  };
  private pool: pg.Pool | null = null;
  private isPgConnected = false;
  private isProduction = process.env.NODE_ENV === 'production';

  constructor() {
    this.initDatabase();
  }

  private async initDatabase() {
    const connString = getDatabaseUrl();

    if (connString) {
      try {
        const cleanUrl = connString.replace(/\?sslmode=[^&]+/, '').replace(/&sslmode=[^&]+/, '');
        
        // Strict TLS: Verify Supabase server certificate using the official Supabase CA bundle
        const caCertPath = path.resolve(process.cwd(), 'certs/supabase-ca.pem');
        let sslConfig: any = { rejectUnauthorized: true };
        if (fs.existsSync(caCertPath)) {
          sslConfig.ca = fs.readFileSync(caCertPath, 'utf-8');
        } else {
          console.warn('[DB] Supabase CA certificate not found at certs/supabase-ca.pem.');
        }

        this.pool = new Pool({
          connectionString: cleanUrl,
          ssl: sslConfig,
          connectionTimeoutMillis: 10000,
        });

        const client = await this.pool.connect();
        try {
          // Deterministic migration: load and execute 001_initial_schema.sql
          const migrationPath = path.resolve(process.cwd(), 'migrations/001_initial_schema.sql');
          if (fs.existsSync(migrationPath)) {
            const sql = fs.readFileSync(migrationPath, 'utf-8');
            await client.query(sql);
          }

          // Populate in-memory query cache from PostgreSQL
          const usersRes = await client.query('SELECT * FROM modelmesh_users');
          const connRes = await client.query('SELECT * FROM modelmesh_provider_connections');
          const chatsRes = await client.query('SELECT * FROM modelmesh_chats ORDER BY created_at DESC');
          const messagesRes = await client.query('SELECT * FROM modelmesh_messages ORDER BY created_at ASC');

          this.data.users = usersRes.rows.map((r) => ({
            id: r.id,
            email: r.email,
            name: r.name,
            password_hash: r.password_hash,
            auth_provider: r.auth_provider,
            created_at: new Date(r.created_at).toISOString(),
          }));

          this.data.provider_connections = connRes.rows.map((r) => ({
            id: r.id,
            user_id: r.user_id,
            provider: r.provider,
            encrypted_credential: r.encrypted_credential,
            connection_status: r.connection_status,
            created_at: new Date(r.created_at).toISOString(),
            updated_at: new Date(r.updated_at).toISOString(),
          }));

          this.data.chats = chatsRes.rows.map((r) => ({
            id: r.id,
            user_id: r.user_id,
            title: r.title,
            created_at: new Date(r.created_at).toISOString(),
          }));

          this.data.messages = messagesRes.rows.map((r) => ({
            id: r.id,
            chat_id: r.chat_id,
            role: r.role,
            content: r.content,
            model_category: r.model_category,
            model_id: r.model_id,
            created_at: new Date(r.created_at).toISOString(),
          }));

          this.isPgConnected = true;
          console.log('[DB] PostgreSQL is active as the single production source of truth.');

          // Clean up any expired or consumed OAuth states on startup
          await client.query('DELETE FROM modelmesh_oauth_states WHERE expires_at < NOW() OR consumed = TRUE');
        } finally {
          client.release();
        }
      } catch (err) {
        console.error('[DB] PostgreSQL initialization failed:', err);
        this.isPgConnected = false;
        if (!this.isProduction) {
          console.warn('[DB] Falling back to local JSON file for development only.');
          this.initLocalFallback();
        }
      }
    } else {
      if (this.isProduction) {
        console.error('[DB] FATAL: DATABASE_URL is missing in production environment!');
      } else {
        console.log('[DB] No DATABASE_URL provided. Using local JSON store for local development only.');
        this.initLocalFallback();
      }
    }
  }

  private initLocalFallback() {
    try {
      const dir = path.dirname(DB_FALLBACK_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (fs.existsSync(DB_FALLBACK_FILE)) {
        const raw = fs.readFileSync(DB_FALLBACK_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        this.data = {
          users: parsed.users || [],
          provider_connections: parsed.provider_connections || [],
          chats: parsed.chats || [],
          messages: parsed.messages || [],
          oauth_states: parsed.oauth_states || [],
        };
      }
    } catch (err) {
      console.error('[DB] Failed to load local JSON fallback:', err);
    }
  }

  private saveLocalFallback() {
    // Only write to disk if PostgreSQL is NOT connected (pure local fallback mode)
    if (this.isPgConnected) return;

    try {
      const dir = path.dirname(DB_FALLBACK_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const tmpFile = `${DB_FALLBACK_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tmpFile, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tmpFile, DB_FALLBACK_FILE);
    } catch (err) {
      console.error('[DB] Failed to save local JSON file:', err);
    }
  }

  // --- Users ---
  findUserByEmail(email: string): DBUser | undefined {
    return this.data.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  }

  findUserById(id: string): DBUser | undefined {
    return this.data.users.find((u) => u.id === id);
  }

  createUser(user: Omit<DBUser, 'id' | 'created_at'>): DBUser {
    const newUser: DBUser = {
      ...user,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };
    this.data.users.push(newUser);
    this.saveLocalFallback();

    if (this.isPgConnected && this.pool) {
      this.pool
        .query(
          `INSERT INTO modelmesh_users (id, email, name, password_hash, auth_provider, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name`,
          [newUser.id, newUser.email, newUser.name, newUser.password_hash || null, newUser.auth_provider || 'email', newUser.created_at]
        )
        .catch((err) => console.error('[DB] PostgreSQL insert user error:', err));
    }

    return newUser;
  }

  // --- Provider Connections ---
  getProviderConnection(userId: string, provider: 'openrouter' = 'openrouter'): DBProviderConnection | undefined {
    return this.data.provider_connections.find(
      (pc) => pc.user_id === userId && pc.provider === provider && pc.connection_status === 'connected'
    );
  }

  getAnyProviderConnection(userId: string, provider: 'openrouter' = 'openrouter'): DBProviderConnection | undefined {
    return this.data.provider_connections.find(
      (pc) => pc.user_id === userId && pc.provider === provider
    );
  }

  saveProviderConnection(
    userId: string,
    provider: 'openrouter',
    encryptedCredential: string,
    status: 'connected' | 'disconnected' | 'error' = 'connected'
  ): DBProviderConnection {
    const existingIndex = this.data.provider_connections.findIndex(
      (pc) => pc.user_id === userId && pc.provider === provider
    );
    const now = new Date().toISOString();

    let resultConn: DBProviderConnection;

    if (existingIndex >= 0) {
      this.data.provider_connections[existingIndex] = {
        ...this.data.provider_connections[existingIndex],
        encrypted_credential: encryptedCredential,
        connection_status: status,
        updated_at: now,
      };
      resultConn = this.data.provider_connections[existingIndex];
    } else {
      resultConn = {
        id: crypto.randomUUID(),
        user_id: userId,
        provider,
        encrypted_credential: encryptedCredential,
        connection_status: status,
        created_at: now,
        updated_at: now,
      };
      this.data.provider_connections.push(resultConn);
    }
    this.saveLocalFallback();

    if (this.isPgConnected && this.pool) {
      this.pool
        .query(
          `INSERT INTO modelmesh_provider_connections (id, user_id, provider, encrypted_credential, connection_status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (user_id, provider) DO UPDATE SET
             encrypted_credential = EXCLUDED.encrypted_credential,
             connection_status = EXCLUDED.connection_status,
             updated_at = EXCLUDED.updated_at`,
          [
            resultConn.id,
            resultConn.user_id,
            resultConn.provider,
            resultConn.encrypted_credential,
            resultConn.connection_status,
            resultConn.created_at,
            resultConn.updated_at,
          ]
        )
        .catch((err) => console.error('[DB] PostgreSQL save provider connection error:', err));
    }

    return resultConn;
  }

  disconnectProvider(userId: string, provider: 'openrouter'): boolean {
    const conn = this.data.provider_connections.find(
      (pc) => pc.user_id === userId && pc.provider === provider
    );
    if (conn) {
      conn.connection_status = 'disconnected';
      conn.encrypted_credential = undefined;
      conn.updated_at = new Date().toISOString();
      this.saveLocalFallback();

      if (this.isPgConnected && this.pool) {
        this.pool
          .query(
            `UPDATE modelmesh_provider_connections
             SET connection_status = 'disconnected', encrypted_credential = NULL, updated_at = NOW()
             WHERE user_id = $1 AND provider = $2`,
            [userId, provider]
          )
          .catch((err) => console.error('[DB] PostgreSQL disconnect error:', err));
      }

      return true;
    }
    return false;
  }

  // --- OAuth PKCE States with Expiry and Consumption Control ---
  saveOAuthState(state: string, codeVerifier: string, userId: string): void {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString(); // 10 minutes expiry

    // Purge expired states in memory
    const nowTime = now.getTime();
    this.data.oauth_states = this.data.oauth_states.filter(
      (s) => new Date(s.expires_at).getTime() > nowTime && !s.consumed
    );

    this.data.oauth_states.push({
      state,
      code_verifier: codeVerifier,
      user_id: userId,
      expires_at: expiresAt,
      consumed: false,
      created_at: now.toISOString(),
    });
    this.saveLocalFallback();

    if (this.isPgConnected && this.pool) {
      this.pool
        .query(
          `INSERT INTO modelmesh_oauth_states (state, code_verifier, user_id, expires_at, consumed, created_at)
           VALUES ($1, $2, $3, $4, FALSE, $5)
           ON CONFLICT (state) DO NOTHING`,
          [state, codeVerifier, userId, expiresAt, now.toISOString()]
        )
        .catch((err) => console.error('[DB] PostgreSQL save oauth state error:', err));
    }
  }

  consumeOAuthState(state: string): DBOAuthState | undefined {
    const nowTime = Date.now();
    const index = this.data.oauth_states.findIndex(
      (s) => s.state === state && !s.consumed && new Date(s.expires_at).getTime() > nowTime
    );

    if (index === -1) {
      // Invalidate on database as well if replayed
      if (this.isPgConnected && this.pool) {
        this.pool.query('DELETE FROM modelmesh_oauth_states WHERE state = $1', [state]).catch(() => {});
      }
      return undefined;
    }

    const [oauthState] = this.data.oauth_states.splice(index, 1);
    oauthState.consumed = true;
    this.saveLocalFallback();

    if (this.isPgConnected && this.pool) {
      // Atomic deletion upon consumption prevents reuse across all instances
      this.pool.query('DELETE FROM modelmesh_oauth_states WHERE state = $1', [state]).catch((err) => {
        console.error('[DB] PostgreSQL delete consumed oauth state error:', err);
      });
    }

    return oauthState;
  }

  // --- Chats ---
  getUserChats(userId: string): Chat[] {
    return this.data.chats
      .filter((c) => c.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  getChatById(chatId: string, userId: string): Chat | undefined {
    return this.data.chats.find((c) => c.id === chatId && c.user_id === userId);
  }

  createChat(userId: string, title: string): Chat {
    const chat: Chat = {
      id: crypto.randomUUID(),
      user_id: userId,
      title: title.slice(0, 100),
      created_at: new Date().toISOString(),
    };
    this.data.chats.unshift(chat);
    this.saveLocalFallback();

    if (this.isPgConnected && this.pool) {
      this.pool
        .query(`INSERT INTO modelmesh_chats (id, user_id, title, created_at) VALUES ($1, $2, $3, $4)`, [
          chat.id,
          chat.user_id,
          chat.title,
          chat.created_at,
        ])
        .catch((err) => console.error('[DB] PostgreSQL create chat error:', err));
    }

    return chat;
  }

  deleteChat(chatId: string, userId: string): boolean {
    const chatIndex = this.data.chats.findIndex((c) => c.id === chatId && c.user_id === userId);
    if (chatIndex === -1) return false;

    this.data.chats.splice(chatIndex, 1);
    this.data.messages = this.data.messages.filter((m) => m.chat_id !== chatId);
    this.saveLocalFallback();

    if (this.isPgConnected && this.pool) {
      // With ON DELETE CASCADE, deleting from modelmesh_chats will automatically cascade to modelmesh_messages
      this.pool
        .query('DELETE FROM modelmesh_chats WHERE id = $1 AND user_id = $2', [chatId, userId])
        .catch((err) => console.error('[DB] PostgreSQL delete chat error:', err));
    }

    return true;
  }

  // --- Messages ---
  getChatMessages(chatId: string): ChatMessage[] {
    return this.data.messages
      .filter((m) => m.chat_id === chatId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }

  createMessage(
    chatId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    modelCategory?: ChatMessage['model_category'],
    modelId?: string
  ): ChatMessage {
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      chat_id: chatId,
      role,
      content,
      model_category: modelCategory,
      model_id: modelId,
      created_at: new Date().toISOString(),
    };
    this.data.messages.push(message);
    this.saveLocalFallback();

    if (this.isPgConnected && this.pool) {
      this.pool
        .query(
          `INSERT INTO modelmesh_messages (id, chat_id, role, content, model_category, model_id, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            message.id,
            message.chat_id,
            message.role,
            message.content,
            message.model_category || null,
            message.model_id || null,
            message.created_at,
          ]
        )
        .catch((err) => console.error('[DB] PostgreSQL create message error:', err));
    }

    return message;
  }
}

export const db = new Database();
