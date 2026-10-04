import { db } from '../db.ts';
import { encryptCredential, decryptCredential } from '../encryption.ts';
import { recordAuditLog } from './audit.ts';
import { PermissionManager } from './permission.ts';
import type { Connector, ConnectionResult, ConnectionStatus, ActionResult } from './types.ts';
import type { ConnectorCapability } from '../../types/index.ts';

const GOOGLE_DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_OAUTH_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

export const GOOGLE_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

const CAPABILITIES: ConnectorCapability[] = [
  {
    name: 'google-drive.listFiles',
    description: 'List Google Drive files that hello has permission to access',
    permissionLevel: 'READ',
  },
  {
    name: 'google-drive.searchFiles',
    description: 'Search permitted Google Drive files by keyword or filename',
    permissionLevel: 'READ',
  },
  {
    name: 'google-drive.readFileMetadata',
    description: 'Read file metadata, size, MIME type, and last modified date',
    permissionLevel: 'READ',
  },
  {
    name: 'google-drive.readFileContent',
    description: 'Read text or Google Doc content with strict untrusted data boundaries',
    permissionLevel: 'READ',
  },
  {
    name: 'google-drive.createFile',
    description: 'Create a new text or markdown file in Google Drive',
    permissionLevel: 'WRITE',
    requiresConfirmation: true,
  },
  {
    name: 'google-drive.updateFile',
    description: 'Update the text content of a permitted file in Google Drive',
    permissionLevel: 'WRITE',
    requiresConfirmation: true,
  },
];

export class GoogleDriveConnector implements Connector {
  readonly provider = 'google-drive' as const;
  readonly displayName = 'Google Drive';
  readonly description = 'Access files you choose with hello.';
  readonly icon = 'google-drive';

  listCapabilities(): ConnectorCapability[] {
    return CAPABILITIES;
  }

  /**
   * Helper to retrieve or refresh a valid access token.
   */
  async getValidAccessToken(userId: string): Promise<string> {
    const conn = await db.getProviderConnection(userId, 'google-drive');
    if (!conn || !conn.encrypted_credential) {
      throw new Error('Google Drive is not connected. Please connect Google Drive first.');
    }

    // Check if token is expired or expiring in less than 2 minutes
    const isExpired = conn.token_expiry && new Date(conn.token_expiry).getTime() - Date.now() < 120 * 1000;

    if (isExpired && conn.encrypted_refresh_token) {
      await this.refreshCredentials(userId);
      const refreshedConn = await db.getProviderConnection(userId, 'google-drive');
      if (refreshedConn?.encrypted_credential) {
        return decryptCredential(refreshedConn.encrypted_credential);
      }
    }

    return decryptCredential(conn.encrypted_credential);
  }

  async refreshCredentials(userId: string): Promise<void> {
    const conn = await db.getProviderConnection(userId, 'google-drive');
    if (!conn || !conn.encrypted_refresh_token) {
      return;
    }

    let refreshToken = '';
    try {
      refreshToken = decryptCredential(conn.encrypted_refresh_token);
    } catch {
      throw new Error('Failed to decrypt Google Drive refresh token.');
    }

    const clientId = conn.metadata?.clientId || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId) {
      throw new Error('Google OAuth Client ID is missing for token refresh.');
    }

    const params: Record<string, string> = {
      client_id: clientId,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    };
    if (clientSecret) {
      params.client_secret = clientSecret;
    }

    const res = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params),
    });

    if (!res.ok) {
      const errText = await res.text();
      // If refresh token was revoked, update status to error/disconnected
      await db.saveProviderConnection(
        userId,
        'google-drive',
        conn.encrypted_credential || '',
        'error',
        {
          providerAccountId: conn.provider_account_id,
          accountUsername: conn.account_username,
          scopes: conn.scopes,
          encryptedRefreshToken: conn.encrypted_refresh_token,
          metadata: {
            ...conn.metadata,
            lastRefreshError: `Refresh failed: ${res.status}`,
          },
        }
      );
      throw new Error(`Google token refresh failed: ${errText.slice(0, 100)}`);
    }

    const tokenData = await res.json();
    const newAccessToken = tokenData.access_token;
    const expiresInSec = tokenData.expires_in || 3600;
    const tokenExpiry = new Date(Date.now() + expiresInSec * 1000).toISOString();

    const encryptedAccessToken = encryptCredential(newAccessToken);
    let encryptedRefreshToken = conn.encrypted_refresh_token;
    if (tokenData.refresh_token) {
      encryptedRefreshToken = encryptCredential(tokenData.refresh_token);
    }

    await db.saveProviderConnection(
      userId,
      'google-drive',
      encryptedAccessToken,
      'connected',
      {
        providerAccountId: conn.provider_account_id,
        accountUsername: conn.account_username,
        scopes: conn.scopes,
        encryptedRefreshToken,
        tokenExpiry,
        metadata: conn.metadata,
      }
    );

    await recordAuditLog({
      userId,
      provider: 'google-drive',
      action: 'refreshCredentials',
      permissionLevel: 'READ',
      status: 'success',
      approvalStatus: 'auto_approved',
    });
  }

  async connect(
    userId: string,
    credentials: {
      accessToken?: string;
      refreshToken?: string;
      expiresIn?: number;
      accountUsername?: string;
      providerAccountId?: string;
      clientId?: string;
      clientSecret?: string;
    }
  ): Promise<ConnectionResult> {
    const accessToken = credentials.accessToken?.trim();
    if (!accessToken) {
      return { success: false, error: 'Google OAuth access token is required.' };
    }

    try {
      // Validate access token by fetching user profile from Google UserInfo endpoint
      const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!userRes.ok) {
        throw new Error(`Invalid Google access token (HTTP ${userRes.status})`);
      }

      const userInfo = await userRes.json();
      const username = userInfo.email || userInfo.name || credentials.accountUsername || 'Google User';
      const providerAccountId = String(userInfo.id || credentials.providerAccountId || 'google-account');

      const encryptedAccess = encryptCredential(accessToken);
      const encryptedRefresh = credentials.refreshToken
        ? encryptCredential(credentials.refreshToken.trim())
        : undefined;

      const tokenExpiry = credentials.expiresIn
        ? new Date(Date.now() + credentials.expiresIn * 1000).toISOString()
        : undefined;

      await db.saveProviderConnection(userId, 'google-drive', encryptedAccess, 'connected', {
        providerAccountId,
        accountUsername: username,
        scopes: GOOGLE_DRIVE_SCOPE,
        encryptedRefreshToken: encryptedRefresh,
        tokenExpiry,
        metadata: {
          clientId: credentials.clientId,
          name: userInfo.name,
          email: userInfo.email,
          picture: userInfo.picture,
          connectedAt: new Date().toISOString(),
        },
      });

      await recordAuditLog({
        userId,
        provider: 'google-drive',
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
        scopes: GOOGLE_DRIVE_SCOPE,
      };
    } catch (err: any) {
      await recordAuditLog({
        userId,
        provider: 'google-drive',
        action: 'connect',
        permissionLevel: 'WRITE',
        status: 'failed',
        details: { error: err.message },
      });
      return { success: false, error: `Google Drive verification failed: ${err.message}` };
    }
  }

  async disconnect(userId: string): Promise<void> {
    const conn = await db.getProviderConnection(userId, 'google-drive');
    if (conn?.encrypted_refresh_token || conn?.encrypted_credential) {
      try {
        const token = decryptCredential(conn.encrypted_refresh_token || conn.encrypted_credential!);
        await fetch(GOOGLE_OAUTH_REVOKE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ token }),
        });
      } catch (err) {
        console.warn('[Google Drive] Revocation error on disconnect:', err);
      }
    }

    await db.disconnectProvider(userId, 'google-drive');

    await recordAuditLog({
      userId,
      provider: 'google-drive',
      action: 'disconnect',
      permissionLevel: 'WRITE',
      status: 'success',
      approvalStatus: 'user_confirmed',
    });
  }

  async getConnectionStatus(userId: string): Promise<ConnectionStatus> {
    const conn = await db.getProviderConnection(userId, 'google-drive');
    if (!conn || conn.connection_status !== 'connected' || !conn.encrypted_credential) {
      return { connected: false };
    }

    // Check if expired
    const isExpired = conn.token_expiry && new Date(conn.token_expiry).getTime() < Date.now();
    if (isExpired && !conn.encrypted_refresh_token) {
      return {
        connected: false,
        error: 'Connection expired. Please reconnect.',
        accountUsername: conn.account_username,
      };
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
        error: `Unknown action '${actionName}' for provider Google Drive.`,
        permissionLevel: 'READ',
      };
    }

    // Block destructive operations
    if (actionName.includes('delete') || actionName.includes('share') || actionName.includes('transfer')) {
      await recordAuditLog({
        userId,
        provider: 'google-drive',
        action: actionName,
        permissionLevel: 'DANGEROUS',
        status: 'denied',
        details: { reason: 'Operation prohibited by Google Drive security policy' },
      });
      return {
        success: false,
        error: 'Deleting files, changing permissions, and transferring ownership are prohibited.',
        permissionLevel: 'DANGEROUS',
      };
    }

    // Permission evaluation
    const evalResult = PermissionManager.evaluate({
      userId,
      provider: 'google-drive',
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

    let token = '';
    try {
      token = await this.getValidAccessToken(userId);
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Google Drive authentication required',
        permissionLevel: cap.permissionLevel,
      };
    }

    try {
      let data: any;

      switch (actionName) {
        case 'google-drive.listFiles': {
          const pageSize = Math.min(Math.max(1, parseInt(String(params.pageSize || '20'), 10)), 50);
          const queryParams = new URLSearchParams({
            pageSize: String(pageSize),
            fields: 'files(id,name,mimeType,size,modifiedTime,webViewLink,description)',
            q: "trashed = false",
            orderBy: 'modifiedTime desc',
          });

          const res = await fetch(`${GOOGLE_DRIVE_API_BASE}/files?${queryParams.toString()}`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (!res.ok) {
            const err = await res.text();
            throw new Error(`Drive list error (${res.status}): ${err.slice(0, 100)}`);
          }

          const resData = await res.json();
          data = (resData.files || []).map((f: any) => ({
            id: f.id,
            name: f.name,
            mimeType: f.mimeType,
            size: f.size ? Number(f.size) : null,
            modifiedTime: f.modifiedTime,
            webViewLink: f.webViewLink,
            description: f.description,
          }));
          break;
        }

        case 'google-drive.searchFiles': {
          const query = String(params.query || '').trim();
          if (!query) throw new Error('Search query parameter is required');

          const safeQ = `name contains '${query.replace(/'/g, "\\'")}' and trashed = false`;
          const queryParams = new URLSearchParams({
            pageSize: '15',
            fields: 'files(id,name,mimeType,size,modifiedTime,webViewLink)',
            q: safeQ,
            orderBy: 'modifiedTime desc',
          });

          const res = await fetch(`${GOOGLE_DRIVE_API_BASE}/files?${queryParams.toString()}`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (!res.ok) {
            const err = await res.text();
            throw new Error(`Drive search error (${res.status}): ${err.slice(0, 100)}`);
          }

          const resData = await res.json();
          data = (resData.files || []).map((f: any) => ({
            id: f.id,
            name: f.name,
            mimeType: f.mimeType,
            size: f.size ? Number(f.size) : null,
            modifiedTime: f.modifiedTime,
            webViewLink: f.webViewLink,
          }));
          break;
        }

        case 'google-drive.readFileMetadata': {
          const fileId = String(params.fileId || '').trim();
          if (!fileId) throw new Error('fileId parameter is required');

          const res = await fetch(
            `${GOOGLE_DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size,createdTime,modifiedTime,owners,description,webViewLink`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );

          if (!res.ok) {
            const err = await res.text();
            throw new Error(`File metadata error (${res.status}): ${err.slice(0, 100)}`);
          }

          data = await res.json();
          break;
        }

        case 'google-drive.readFileContent': {
          const fileId = String(params.fileId || '').trim();
          if (!fileId) throw new Error('fileId parameter is required');

          // First inspect metadata to determine MIME type
          const metaRes = await fetch(
            `${GOOGLE_DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );

          if (!metaRes.ok) {
            const err = await metaRes.text();
            throw new Error(`Could not access file metadata (${metaRes.status}): ${err.slice(0, 100)}`);
          }

          const fileMeta = await metaRes.json();
          const mimeType = fileMeta.mimeType || '';

          let rawContent = '';

          if (mimeType === 'application/vnd.google-apps.document') {
            // Export Google Doc as plain text
            const exportRes = await fetch(
              `${GOOGLE_DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}/export?mimeType=text/plain`,
              {
                headers: { Authorization: `Bearer ${token}` },
              }
            );
            if (!exportRes.ok) {
              throw new Error(`Failed to export Google Doc (${exportRes.status})`);
            }
            rawContent = await exportRes.text();
          } else {
            // Standard file download
            const downloadRes = await fetch(
              `${GOOGLE_DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}?alt=media`,
              {
                headers: { Authorization: `Bearer ${token}` },
              }
            );
            if (!downloadRes.ok) {
              throw new Error(`Failed to read file content (${downloadRes.status})`);
            }
            rawContent = await downloadRes.text();
          }

          // Cap content at 40,000 characters to prevent memory/context overflow
          const truncated = rawContent.length > 40000;
          const safeText = truncated ? rawContent.slice(0, 40000) + '\n... [TRUNCATED DUE TO SIZE]' : rawContent;

          data = {
            id: fileMeta.id,
            name: fileMeta.name,
            mimeType: fileMeta.mimeType,
            contentLength: rawContent.length,
            isTruncated: truncated,
            content: safeText,
          };
          break;
        }

        case 'google-drive.createFile': {
          const name = String(params.name || 'Untitled document.txt').trim();
          const content = String(params.content || '');
          const mimeType = params.mimeType || 'text/plain';

          // Simple upload using multipart/related
          const boundary = `-------ModelMeshBoundary${Date.now()}`;
          const metadata = JSON.stringify({ name, mimeType });

          const multipartBody =
            `--${boundary}\r\n` +
            `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
            `${metadata}\r\n` +
            `--${boundary}\r\n` +
            `Content-Type: ${mimeType}\r\n\r\n` +
            `${content}\r\n` +
            `--${boundary}--`;

          const res = await fetch(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink',
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': `multipart/related; boundary=${boundary}`,
              },
              body: multipartBody,
            }
          );

          if (!res.ok) {
            const err = await res.text();
            throw new Error(`Drive createFile error (${res.status}): ${err.slice(0, 100)}`);
          }

          data = await res.json();
          break;
        }

        case 'google-drive.updateFile': {
          const fileId = String(params.fileId || '').trim();
          const content = String(params.content || '');
          if (!fileId) throw new Error('fileId parameter is required to update file');

          const res = await fetch(
            `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=media&fields=id,name,mimeType,modifiedTime`,
            {
              method: 'PATCH',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': params.mimeType || 'text/plain',
              },
              body: content,
            }
          );

          if (!res.ok) {
            const err = await res.text();
            throw new Error(`Drive updateFile error (${res.status}): ${err.slice(0, 100)}`);
          }

          data = await res.json();
          break;
        }

        default:
          throw new Error(`Unhandled Google Drive action: ${actionName}`);
      }

      // Record sanitized audit log (NEVER logs full file contents)
      await recordAuditLog({
        userId,
        provider: 'google-drive',
        action: actionName,
        resource: params.fileId || params.name,
        permissionLevel: cap.permissionLevel,
        status: 'success',
        approvalStatus: isConfirmed ? 'user_confirmed' : 'auto_approved',
        details: {
          fileId: params.fileId,
          name: params.name,
          query: params.query,
          pageSize: params.pageSize,
        },
      });

      return {
        success: true,
        data,
        permissionLevel: cap.permissionLevel,
      };
    } catch (err: any) {
      await recordAuditLog({
        userId,
        provider: 'google-drive',
        action: actionName,
        resource: params.fileId || params.name,
        permissionLevel: cap.permissionLevel,
        status: 'failed',
        details: { error: err.message, fileId: params.fileId },
      });

      return {
        success: false,
        error: err.message,
        permissionLevel: cap.permissionLevel,
      };
    }
  }
}
