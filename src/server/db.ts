import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { PostgresDatabase } from './postgres.ts';
import { getDatabaseUrl, loadEnvironment } from './env.ts';
import type { User, ProviderConnection, Chat, ChatMessage } from '../types/index.ts';

loadEnvironment();

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

class LocalDatabase {
  async checkHealth() { return; }

  private data: DatabaseSchema = {
    users: [],
    provider_connections: [],
    chats: [],
    messages: [],
    oauth_states: [],
  };

  constructor() {
    this.initLocalFallback();
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

  }

  consumeOAuthState(state: string): DBOAuthState | undefined {
    const nowTime = Date.now();
    const index = this.data.oauth_states.findIndex(
      (s) => s.state === state && !s.consumed && new Date(s.expires_at).getTime() > nowTime
    );

    if (index === -1) {
      // Invalidate on database as well if replayed

      return undefined;
    }

    const [oauthState] = this.data.oauth_states.splice(index, 1);
    oauthState.consumed = true;
    this.saveLocalFallback();

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

    return chat;
  }

  deleteChat(chatId: string, userId: string): boolean {
    const chatIndex = this.data.chats.findIndex((c) => c.id === chatId && c.user_id === userId);
    if (chatIndex === -1) return false;

    this.data.chats.splice(chatIndex, 1);
    this.data.messages = this.data.messages.filter((m) => m.chat_id !== chatId);
    this.saveLocalFallback();

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

    return message;
  }
}

export const db = process.env.NODE_ENV === 'production' || getDatabaseUrl()
  ? new PostgresDatabase()
  : new LocalDatabase();
