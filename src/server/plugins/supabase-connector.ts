import { db } from '../db.ts';
import { encryptCredential, decryptCredential } from '../encryption.ts';
import { recordAuditLog } from './audit.ts';
import { PermissionManager } from './permission.ts';
import type { Connector, ConnectionResult, ConnectionStatus, ActionResult } from './types.ts';
import type { ConnectorCapability } from '../../types/index.ts';

const SUPABASE_API_BASE = 'https://api.supabase.com';

const CAPABILITIES: ConnectorCapability[] = [
  {
    name: 'supabase.listProjects',
    description: 'List user Supabase projects, regions, and statuses',
    permissionLevel: 'READ',
  },
  {
    name: 'supabase.checkHealth',
    description: 'Check health and database status of a Supabase project',
    permissionLevel: 'READ',
  },
  {
    name: 'supabase.listTables',
    description: 'List schema tables and views in a Supabase project',
    permissionLevel: 'READ',
  },
  {
    name: 'supabase.inspectTable',
    description: 'Inspect columns, data types, constraints, and keys of a table',
    permissionLevel: 'READ',
  },
  {
    name: 'supabase.readData',
    description: 'Read data rows from a table with strict safe limit (max 50 rows)',
    permissionLevel: 'READ',
  },
  {
    name: 'supabase.insertRow',
    description: 'Insert a new row record into a table',
    permissionLevel: 'WRITE',
    requiresConfirmation: true,
  },
  {
    name: 'supabase.updateRow',
    description: 'Update row record(s) matching a specific condition in a table',
    permissionLevel: 'WRITE',
    requiresConfirmation: true,
  },
];

// Blocklist for dangerous destructive SQL tokens
const DANGEROUS_SQL_PATTERNS = [
  /\bDROP\s+(TABLE|DATABASE|SCHEMA|VIEW|INDEX|TRIGGER|FUNCTION)\b/i,
  /\bTRUNCATE\s+(TABLE)?\b/i,
  /\bALTER\s+TABLE\s+.*DROP\b/i,
  /\bDELETE\s+FROM\s+\w+\s*(;|$)/i, // Unconditional delete
];

export class SupabaseConnector implements Connector {
  readonly provider = 'supabase' as const;
  readonly displayName = 'Supabase';
  readonly description = 'Inspect projects, database health, schemas, tables, and safely query records.';
  readonly icon = 'supabase';

  listCapabilities(): ConnectorCapability[] {
    return CAPABILITIES;
  }

  private async fetchSupabaseManagement(token: string, endpoint: string, options: RequestInit = {}): Promise<any> {
    const res = await fetch(`${SUPABASE_API_BASE}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'ModelMesh-AI-Workspace/1.0',
        ...(options.headers || {}),
      },
    });

    if (!res.ok) {
      const errBody = await res.text();
      let errorMsg = `Supabase API error: ${res.status}`;
      try {
        const parsed = JSON.parse(errBody);
        errorMsg = parsed.message || parsed.error || errorMsg;
      } catch {
        errorMsg = errBody.slice(0, 100) || errorMsg;
      }
      throw new Error(errorMsg);
    }

    if (res.status === 204) return null;
    return res.json();
  }

  async connect(
    userId: string,
    credentials: { token?: string; projectUrl?: string; apiKey?: string }
  ): Promise<ConnectionResult> {
    const token = credentials.token?.trim();
    const projectUrl = credentials.projectUrl?.trim();
    const apiKey = credentials.apiKey?.trim();

    if (!token && (!projectUrl || !apiKey)) {
      return {
        success: false,
        error: 'Either a Supabase Personal Access Token (Management API) or Project URL + API Key is required.',
      };
    }

    try {
      let username = 'Supabase User';
      let providerAccountId = '';
      let credentialData = '';

      if (token) {
        // Test Management API token
        const projects = await this.fetchSupabaseManagement(token, '/v1/projects');
        username = `Management API (${projects.length} projects)`;
        providerAccountId = 'management-api';
        credentialData = JSON.stringify({ type: 'management', token });
      } else if (projectUrl && apiKey) {
        // Test project API URL
        const cleanUrl = projectUrl.replace(/\/+$/, '');
        const testRes = await fetch(`${cleanUrl}/rest/v1/`, {
          headers: {
            apikey: apiKey,
            Authorization: `Bearer ${apiKey}`,
          },
        });
        if (!testRes.ok) {
          throw new Error(`Project API returned HTTP ${testRes.status}`);
        }
        const refMatch = cleanUrl.match(/https:\/\/([a-z0-9-]+)\.supabase\.co/);
        const ref = refMatch ? refMatch[1] : 'custom-project';
        username = `Project: ${ref}`;
        providerAccountId = ref;
        credentialData = JSON.stringify({ type: 'project', projectUrl: cleanUrl, apiKey });
      }

      const encrypted = encryptCredential(credentialData);
      db.saveProviderConnection(userId, 'supabase', encrypted, 'connected', {
        providerAccountId,
        accountUsername: username,
        scopes: 'database,tables,read,write',
        metadata: {
          connectedAt: new Date().toISOString(),
        },
      });

      recordAuditLog({
        userId,
        provider: 'supabase',
        action: 'connect',
        permissionLevel: 'WRITE',
        status: 'success',
        approvalStatus: 'user_confirmed',
        details: { username, providerAccountId },
      });

      return {
        success: true,
        accountUsername: username,
        providerAccountId,
      };
    } catch (err: any) {
      recordAuditLog({
        userId,
        provider: 'supabase',
        action: 'connect',
        permissionLevel: 'WRITE',
        status: 'failed',
        details: { error: err.message },
      });
      return { success: false, error: `Supabase connection failed: ${err.message}` };
    }
  }

  async disconnect(userId: string): Promise<void> {
    db.disconnectProvider(userId, 'supabase');
    recordAuditLog({
      userId,
      provider: 'supabase',
      action: 'disconnect',
      permissionLevel: 'WRITE',
      status: 'success',
      approvalStatus: 'user_confirmed',
    });
  }

  async getConnectionStatus(userId: string): Promise<ConnectionStatus> {
    const conn = db.getProviderConnection(userId, 'supabase');
    if (!conn || conn.connection_status !== 'connected' || !conn.encrypted_credential) {
      return { connected: false };
    }
    return {
      connected: true,
      accountUsername: conn.account_username,
      providerAccountId: conn.provider_account_id,
      scopes: conn.scopes,
      connectedAt: conn.updated_at,
    };
  }

  async executeAction(
    userId: string,
    actionName: string,
    params: Record<string, any>,
    isConfirmed = false,
    proposalId?: string
  ): Promise<ActionResult> {
    const cap = CAPABILITIES.find((c) => c.name === actionName);
    if (!cap) {
      return {
        success: false,
        error: `Unknown action '${actionName}' for provider Supabase.`,
        permissionLevel: 'READ',
      };
    }

    // Safety checks against destructive statements
    if (params.query) {
      for (const pattern of DANGEROUS_SQL_PATTERNS) {
        if (pattern.test(params.query)) {
          recordAuditLog({
            userId,
            provider: 'supabase',
            action: actionName,
            permissionLevel: 'DANGEROUS',
            status: 'denied',
            details: { reason: 'Destructive SQL statement rejected by safety rules', query: params.query },
          });
          return {
            success: false,
            error: 'Destructive SQL operation (DROP, TRUNCATE, ALTER, or unbounded DELETE) is blocked by safety policy.',
            permissionLevel: 'DANGEROUS',
          };
        }
      }
    }

    const evalResult = PermissionManager.evaluate({
      userId,
      provider: 'supabase',
      action: actionName,
      description: cap.description,
      permissionLevel: cap.permissionLevel,
      actionParams: params,
      isConfirmed,
      proposalId,
    });

    if (evalResult.requiresConfirmation) {
      return {
        success: false,
        requiresConfirmation: true,
        permissionLevel: cap.permissionLevel,
        proposal: evalResult.proposal,
        error: evalResult.reason,
      };
    }

    const conn = db.getProviderConnection(userId, 'supabase');
    if (!conn || !conn.encrypted_credential) {
      return {
        success: false,
        error: 'Supabase is not connected. Please connect Supabase to execute this action.',
        permissionLevel: cap.permissionLevel,
      };
    }

    let creds: { type: 'management' | 'project'; token?: string; projectUrl?: string; apiKey?: string };
    try {
      const raw = decryptCredential(conn.encrypted_credential);
      creds = JSON.parse(raw);
    } catch {
      return {
        success: false,
        error: 'Failed to decrypt Supabase credentials. Please reconnect Supabase.',
        permissionLevel: cap.permissionLevel,
      };
    }

    try {
      let data: any;

      switch (actionName) {
        case 'supabase.listProjects': {
          if (creds.type === 'management' && creds.token) {
            const raw = await this.fetchSupabaseManagement(creds.token, '/v1/projects');
            data = (raw || []).map((p: any) => ({
              id: p.id,
              name: p.name,
              organizationId: p.organization_id,
              region: p.region,
              status: p.status,
              createdAt: p.created_at,
            }));
          } else {
            data = [
              {
                id: conn.provider_account_id,
                name: conn.account_username,
                url: creds.projectUrl,
                status: 'ACTIVE_HEALTHY',
              },
            ];
          }
          break;
        }

        case 'supabase.checkHealth': {
          const projectRef = params.projectRef || conn.provider_account_id;
          if (creds.type === 'management' && creds.token && projectRef) {
            const res = await this.fetchSupabaseManagement(
              creds.token,
              `/v1/projects/${encodeURIComponent(projectRef)}/health?services=db`
            );
            data = res;
          } else if (creds.projectUrl && creds.apiKey) {
            const res = await fetch(`${creds.projectUrl}/rest/v1/`, {
              headers: { apikey: creds.apiKey, Authorization: `Bearer ${creds.apiKey}` },
            });
            data = {
              status: res.ok ? 'HEALTHY' : 'UNHEALTHY',
              statusCode: res.status,
              endpoint: creds.projectUrl,
            };
          } else {
            throw new Error('Project reference or URL required to check health');
          }
          break;
        }

        case 'supabase.listTables': {
          const projectRef = params.projectRef || conn.provider_account_id;
          if (creds.type === 'management' && creds.token && projectRef) {
            const raw = await this.fetchSupabaseManagement(
              creds.token,
              `/v1/projects/${encodeURIComponent(projectRef)}/database/tables`
            );
            data = (raw || []).map((t: any) => ({
              id: t.id,
              name: t.name,
              schema: t.schema,
              rowCount: t.live_rows_estimate,
              bytes: t.bytes,
            }));
          } else if (creds.projectUrl && creds.apiKey) {
            // Introspect tables using OpenAPI schema
            const res = await fetch(`${creds.projectUrl}/rest/v1/`, {
              headers: {
                apikey: creds.apiKey,
                Authorization: `Bearer ${creds.apiKey}`,
                Accept: 'application/openapi+json',
              },
            });
            if (res.ok) {
              const openapi = await res.json();
              const definitions = Object.keys(openapi.definitions || {});
              data = definitions.map((name) => ({
                name,
                schema: 'public',
              }));
            } else {
              throw new Error(`Failed to introspect tables: HTTP ${res.status}`);
            }
          } else {
            throw new Error('Could not list tables: missing credentials');
          }
          break;
        }

        case 'supabase.inspectTable': {
          const { tableName, projectRef } = params;
          if (!tableName) throw new Error('tableName parameter is required');
          const ref = projectRef || conn.provider_account_id;

          if (creds.type === 'management' && creds.token && ref) {
            const raw = await this.fetchSupabaseManagement(
              creds.token,
              `/v1/projects/${encodeURIComponent(ref)}/database/tables`
            );
            const table = (raw || []).find((t: any) => t.name === tableName);
            if (!table) throw new Error(`Table '${tableName}' not found in project`);
            data = {
              name: table.name,
              schema: table.schema,
              columns: (table.columns || []).map((c: any) => ({
                name: c.name,
                format: c.format,
                dataType: c.data_type,
                isNullable: c.is_nullable,
                isIdentity: c.is_identity,
                defaultValue: c.default_value,
              })),
              primaryKeys: table.primary_keys,
            };
          } else if (creds.projectUrl && creds.apiKey) {
            const res = await fetch(`${creds.projectUrl}/rest/v1/`, {
              headers: {
                apikey: creds.apiKey,
                Authorization: `Bearer ${creds.apiKey}`,
                Accept: 'application/openapi+json',
              },
            });
            const openapi = await res.json();
            const def = openapi.definitions?.[tableName];
            if (!def) throw new Error(`Table '${tableName}' definition not found`);
            data = {
              name: tableName,
              properties: def.properties,
              required: def.required,
            };
          } else {
            throw new Error('Missing project context to inspect table');
          }
          break;
        }

        case 'supabase.readData': {
          const { tableName, limit = 20, select = '*' } = params;
          if (!tableName) throw new Error('tableName is required to read data');
          const safeLimit = Math.min(Math.max(1, parseInt(String(limit), 10) || 20), 50);

          let projectUrl = creds.projectUrl;
          let apiKey = creds.apiKey;

          if (!projectUrl && creds.type === 'management' && creds.token) {
            const ref = params.projectRef || conn.provider_account_id;
            if (ref) {
              projectUrl = `https://${ref}.supabase.co`;
              const apiKeys = await this.fetchSupabaseManagement(
                creds.token,
                `/v1/projects/${encodeURIComponent(ref)}/api-keys`
              );
              const anonKey = (apiKeys || []).find((k: any) => k.name === 'anon' || k.tags === 'anon')?.api_key;
              apiKey = anonKey || apiKeys?.[0]?.api_key;
            }
          }

          if (!projectUrl || !apiKey) {
            throw new Error('Project URL and API Key required to read records via REST');
          }

          const res = await fetch(`${projectUrl}/rest/v1/${encodeURIComponent(tableName)}?select=${encodeURIComponent(select)}&limit=${safeLimit}`, {
            headers: {
              apikey: apiKey,
              Authorization: `Bearer ${apiKey}`,
            },
          });

          if (!res.ok) {
            throw new Error(`Data query failed: HTTP ${res.status}`);
          }

          const rows = await res.json();
          data = {
            table: tableName,
            count: rows.length,
            limit: safeLimit,
            rows,
          };
          break;
        }

        case 'supabase.insertRow': {
          const { tableName, row } = params;
          if (!tableName || !row || typeof row !== 'object') {
            throw new Error('tableName and row object are required to insert');
          }

          let projectUrl = creds.projectUrl;
          let apiKey = creds.apiKey;
          if (!projectUrl && creds.type === 'management' && creds.token) {
            const ref = params.projectRef || conn.provider_account_id;
            projectUrl = `https://${ref}.supabase.co`;
            const apiKeys = await this.fetchSupabaseManagement(
              creds.token,
              `/v1/projects/${encodeURIComponent(ref)}/api-keys`
            );
            apiKey = apiKeys?.find((k: any) => k.name === 'service_role')?.api_key || apiKeys?.[0]?.api_key;
          }

          if (!projectUrl || !apiKey) throw new Error('Missing project URL/key for insert');

          const res = await fetch(`${projectUrl}/rest/v1/${encodeURIComponent(tableName)}`, {
            method: 'POST',
            headers: {
              apikey: apiKey,
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              Prefer: 'return=representation',
            },
            body: JSON.stringify(row),
          });

          if (!res.ok) {
            const text = await res.text();
            throw new Error(`Insert failed: ${text}`);
          }

          data = await res.json();
          break;
        }

        case 'supabase.updateRow': {
          const { tableName, updates, matchColumn, matchValue } = params;
          if (!tableName || !updates || !matchColumn || matchValue === undefined) {
            throw new Error('tableName, updates, matchColumn, and matchValue are required to update');
          }

          let projectUrl = creds.projectUrl;
          let apiKey = creds.apiKey;
          if (!projectUrl && creds.type === 'management' && creds.token) {
            const ref = params.projectRef || conn.provider_account_id;
            projectUrl = `https://${ref}.supabase.co`;
            const apiKeys = await this.fetchSupabaseManagement(
              creds.token,
              `/v1/projects/${encodeURIComponent(ref)}/api-keys`
            );
            apiKey = apiKeys?.find((k: any) => k.name === 'service_role')?.api_key || apiKeys?.[0]?.api_key;
          }

          if (!projectUrl || !apiKey) throw new Error('Missing project URL/key for update');

          const res = await fetch(
            `${projectUrl}/rest/v1/${encodeURIComponent(tableName)}?${encodeURIComponent(matchColumn)}=eq.${encodeURIComponent(String(matchValue))}`,
            {
              method: 'PATCH',
              headers: {
                apikey: apiKey,
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                Prefer: 'return=representation',
              },
              body: JSON.stringify(updates),
            }
          );

          if (!res.ok) {
            const text = await res.text();
            throw new Error(`Update failed: ${text}`);
          }

          data = await res.json();
          break;
        }

        default:
          throw new Error(`Unhandled Supabase action: ${actionName}`);
      }

      recordAuditLog({
        userId,
        provider: 'supabase',
        action: actionName,
        resource: params.tableName || params.projectRef,
        permissionLevel: cap.permissionLevel,
        status: 'success',
        approvalStatus: isConfirmed ? 'user_confirmed' : 'auto_approved',
        details: params,
      });

      return {
        success: true,
        data,
        permissionLevel: cap.permissionLevel,
      };
    } catch (err: any) {
      recordAuditLog({
        userId,
        provider: 'supabase',
        action: actionName,
        resource: params.tableName || params.projectRef,
        permissionLevel: cap.permissionLevel,
        status: 'failed',
        details: { error: err.message, params },
      });

      return {
        success: false,
        error: err.message,
        permissionLevel: cap.permissionLevel,
      };
    }
  }
}
