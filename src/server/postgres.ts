import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';
import { getDatabaseUrl } from './env.ts';
import type { DBUser, DBProviderConnection, DBOAuthState, ConnectionOptions } from './db.ts';
import type { Chat, ChatMessage, IntegrationProvider, AuditLogEntry } from '../types/index.ts';

// Each query uses PostgreSQL as the source of truth. Never cache user data or
// acknowledge a write before it commits: function instances do not share memory.
export class PostgresDatabase {
  private pool?: pg.Pool;

  async checkHealth() {
    await this.rows(`SELECT 1 FROM modelmesh_users, modelmesh_chats, modelmesh_messages,
      modelmesh_provider_connections, modelmesh_oauth_states LIMIT 0`);
  }

  private getPool() {
    if (this.pool) return this.pool;
    const value = getDatabaseUrl();
    if (!value) throw new Error('DATABASE_URL is required');
    const url = new URL(value);
    for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) url.searchParams.delete(key);
    const certPath = path.resolve(process.cwd(), 'certs/supabase-ca.pem');
    this.pool = new pg.Pool({
      connectionString: url.toString(),
      ssl: { rejectUnauthorized: true, ...(fs.existsSync(certPath) ? { ca: fs.readFileSync(certPath, 'utf8') } : {}) },
      max: 3,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 10000,
      allowExitOnIdle: true,
    });
    this.pool.on('error', (error) => console.error('[DB pool]', error.name));
    return this.pool;
  }

  private async rows<T>(sql: string, values: unknown[] = []): Promise<T[]> {
    const result = await this.getPool().query(sql, values);
    return result.rows.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) =>
      [key, value instanceof Date ? value.toISOString() : value]))) as T[];
  }

  async findUserByEmail(email: string) {
    return (await this.rows<DBUser>('SELECT * FROM modelmesh_users WHERE lower(email) = lower($1) LIMIT 1', [email]))[0];
  }
  async findUserById(id: string) {
    return (await this.rows<DBUser>('SELECT * FROM modelmesh_users WHERE id = $1', [id]))[0];
  }
  async createUser(user: Omit<DBUser, 'id' | 'created_at'>) {
    return (await this.rows<DBUser>(
      `INSERT INTO modelmesh_users (id,email,name,password_hash,auth_provider)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [crypto.randomUUID(), user.email.trim().toLowerCase(), user.name, user.password_hash || null, user.auth_provider || 'email']))[0];
  }
  async getProviderConnection(userId: string, provider: IntegrationProvider = 'openrouter') {
    return (await this.rows<DBProviderConnection>(
      `SELECT * FROM modelmesh_provider_connections WHERE user_id=$1 AND provider=$2 AND connection_status='connected'`, [userId, provider]))[0];
  }
  async getAnyProviderConnection(userId: string, provider: IntegrationProvider = 'openrouter') {
    return (await this.rows<DBProviderConnection>('SELECT * FROM modelmesh_provider_connections WHERE user_id=$1 AND provider=$2', [userId, provider]))[0];
  }
  async saveProviderConnection(userId: string, provider: IntegrationProvider, encryptedCredential: string, status: 'connected' | 'disconnected' | 'error' = 'connected', options: ConnectionOptions = {}) {
    return (await this.rows<DBProviderConnection>(
      `INSERT INTO modelmesh_provider_connections (id,user_id,provider,encrypted_credential,connection_status,provider_account_id,account_username,scopes,encrypted_refresh_token,token_expiry,metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (user_id,provider) DO UPDATE SET
       encrypted_credential=EXCLUDED.encrypted_credential, connection_status=EXCLUDED.connection_status,
       provider_account_id=COALESCE(EXCLUDED.provider_account_id,modelmesh_provider_connections.provider_account_id),
       account_username=COALESCE(EXCLUDED.account_username,modelmesh_provider_connections.account_username),
       scopes=COALESCE(EXCLUDED.scopes,modelmesh_provider_connections.scopes),
       encrypted_refresh_token=COALESCE(EXCLUDED.encrypted_refresh_token,modelmesh_provider_connections.encrypted_refresh_token),
       token_expiry=COALESCE(EXCLUDED.token_expiry,modelmesh_provider_connections.token_expiry),
       metadata=COALESCE(EXCLUDED.metadata,modelmesh_provider_connections.metadata),
       updated_at=NOW() RETURNING *`, [crypto.randomUUID(),userId,provider,encryptedCredential,status,
       options.providerAccountId || null,options.accountUsername || null,options.scopes || null,
       options.encryptedRefreshToken || null,options.tokenExpiry || null,options.metadata ? JSON.stringify(options.metadata) : null]))[0];
  }
  async disconnectProvider(userId: string, provider: IntegrationProvider) {
    return (await this.rows(`UPDATE modelmesh_provider_connections SET connection_status='disconnected',
      encrypted_credential=NULL, encrypted_refresh_token=NULL, updated_at=NOW() WHERE user_id=$1 AND provider=$2 RETURNING id`, [userId,provider])).length > 0;
  }
  async getAllProviderConnections(userId: string) {
    return this.rows<DBProviderConnection>('SELECT * FROM modelmesh_provider_connections WHERE user_id=$1', [userId]);
  }
  async createAuditLog(entry: Omit<AuditLogEntry, 'id' | 'created_at'>) {
    return (await this.rows<AuditLogEntry>(`INSERT INTO modelmesh_audit_logs
      (id,user_id,provider,action,resource,permission_level,status,approval_status,details)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [crypto.randomUUID(),entry.user_id,entry.provider,entry.action,entry.resource || null,
       entry.permission_level,entry.status,entry.approval_status || null,entry.details ? JSON.stringify(entry.details) : null]))[0];
  }
  async getAuditLogs(userId: string) {
    return this.rows<AuditLogEntry>('SELECT * FROM modelmesh_audit_logs WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100', [userId]);
  }
  async saveOAuthState(state: string, codeVerifier: string, userId: string) {
    await this.rows(`INSERT INTO modelmesh_oauth_states (state,code_verifier,user_id,expires_at)
      VALUES ($1,$2,$3,NOW()+INTERVAL '10 minutes')`, [state,codeVerifier,userId]);
  }
  async consumeOAuthState(state: string) {
    // One atomic statement: only one instance can consume the state.
    return (await this.rows<DBOAuthState>(`DELETE FROM modelmesh_oauth_states
      WHERE state=$1 AND consumed=FALSE AND expires_at>NOW() RETURNING *`, [state]))[0];
  }
  async getUserChats(userId: string) {
    return this.rows<Chat>('SELECT * FROM modelmesh_chats WHERE user_id=$1 ORDER BY created_at DESC', [userId]);
  }
  async getChatById(chatId: string, userId: string) {
    return (await this.rows<Chat>('SELECT * FROM modelmesh_chats WHERE id=$1 AND user_id=$2', [chatId,userId]))[0];
  }
  async createChat(userId: string, title: string) {
    return (await this.rows<Chat>('INSERT INTO modelmesh_chats (id,user_id,title) VALUES ($1,$2,$3) RETURNING *',
      [crypto.randomUUID(),userId,title.slice(0,100)]))[0];
  }
  async deleteChat(chatId: string, userId: string) {
    return (await this.rows('DELETE FROM modelmesh_chats WHERE id=$1 AND user_id=$2 RETURNING id', [chatId,userId])).length > 0;
  }
  async getChatMessages(chatId: string) {
    return this.rows<ChatMessage>('SELECT * FROM modelmesh_messages WHERE chat_id=$1 ORDER BY created_at ASC', [chatId]);
  }
  async createMessage(chatId: string, role: 'user' | 'assistant' | 'system', content: string, modelCategory?: ChatMessage['model_category'], modelId?: string) {
    return (await this.rows<ChatMessage>(`INSERT INTO modelmesh_messages (id,chat_id,role,content,model_category,model_id)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`, [crypto.randomUUID(),chatId,role,content,modelCategory || null,modelId || null]))[0];
  }
}
