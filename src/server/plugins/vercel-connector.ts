import { db } from '../db.ts';
import { encryptCredential, decryptCredential } from '../encryption.ts';
import { recordAuditLog } from './audit.ts';
import { PermissionManager } from './permission.ts';
import type { Connector, ConnectionResult, ConnectionStatus, ActionResult } from './types.ts';
import type { ConnectorCapability } from '../../types/index.ts';

const VERCEL_API_BASE = 'https://api.vercel.com';

const CAPABILITIES: ConnectorCapability[] = [
  {
    name: 'vercel.listTeams',
    description: 'List accessible Vercel teams and accounts',
    permissionLevel: 'READ',
  },
  {
    name: 'vercel.listProjects',
    description: 'List Vercel projects and their latest deployment states',
    permissionLevel: 'READ',
  },
  {
    name: 'vercel.getProject',
    description: 'Get project details, framework, and linked repository',
    permissionLevel: 'READ',
  },
  {
    name: 'vercel.listDeployments',
    description: 'List recent deployments for a project',
    permissionLevel: 'READ',
  },
  {
    name: 'vercel.getDeployment',
    description: 'Get details, status, error states, and commit info of a deployment',
    permissionLevel: 'READ',
  },
  {
    name: 'vercel.getDeploymentLogs',
    description: 'Read build and runtime logs for a failed or running deployment',
    permissionLevel: 'READ',
  },
  {
    name: 'vercel.listEnvNames',
    description: 'Read environment variable names only (SECRET VALUES ARE NEVER EXPOSED)',
    permissionLevel: 'READ',
  },
  {
    name: 'vercel.redeployProject',
    description: 'Trigger a redeployment of an existing Vercel project deployment',
    permissionLevel: 'WRITE',
    requiresConfirmation: true,
  },
];

export class VercelConnector implements Connector {
  readonly provider = 'vercel' as const;
  readonly displayName = 'Vercel';
  readonly description = 'Inspect projects, deployments, build logs, and environment variable names.';
  readonly icon = 'vercel';

  listCapabilities(): ConnectorCapability[] {
    return CAPABILITIES;
  }

  private async fetchVercel(token: string, endpoint: string, options: RequestInit = {}): Promise<any> {
    const res = await fetch(`${VERCEL_API_BASE}${endpoint}`, {
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
      let errorMsg = `Vercel API error: ${res.status}`;
      try {
        const parsed = JSON.parse(errBody);
        errorMsg = parsed.error?.message || parsed.message || errorMsg;
      } catch {
        errorMsg = errBody.slice(0, 100) || errorMsg;
      }
      throw new Error(errorMsg);
    }

    if (res.status === 204) return null;
    return res.json();
  }

  async connect(userId: string, credentials: { token?: string }): Promise<ConnectionResult> {
    const token = credentials.token?.trim();
    if (!token) {
      return { success: false, error: 'Vercel personal access token is required.' };
    }

    try {
      const userRes = await this.fetchVercel(token, '/v2/user');
      const userObj = userRes.user || userRes;
      const username = userObj.username || userObj.email;
      const providerAccountId = String(userObj.id);

      const encrypted = encryptCredential(token);
      await db.saveProviderConnection(userId, 'vercel', encrypted, 'connected', {
        providerAccountId,
        accountUsername: username,
        scopes: 'projects,deployments,logs',
        metadata: {
          name: userObj.name,
          email: userObj.email,
        },
      });

      await recordAuditLog({
        userId,
        provider: 'vercel',
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
      await recordAuditLog({
        userId,
        provider: 'vercel',
        action: 'connect',
        permissionLevel: 'WRITE',
        status: 'failed',
        details: { error: err.message },
      });
      return { success: false, error: `Vercel verification failed: ${err.message}` };
    }
  }

  async disconnect(userId: string): Promise<void> {
    await db.disconnectProvider(userId, 'vercel');
    await recordAuditLog({
      userId,
      provider: 'vercel',
      action: 'disconnect',
      permissionLevel: 'WRITE',
      status: 'success',
      approvalStatus: 'user_confirmed',
    });
  }

  async getConnectionStatus(userId: string): Promise<ConnectionStatus> {
    const conn = await db.getProviderConnection(userId, 'vercel');
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
        error: `Unknown action '${actionName}' for provider Vercel.`,
        permissionLevel: 'READ',
      };
    }

    const evalResult = PermissionManager.evaluate({
      userId,
      provider: 'vercel',
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

    const conn = await db.getProviderConnection(userId, 'vercel');
    if (!conn || !conn.encrypted_credential) {
      return {
        success: false,
        error: 'Vercel is not connected. Please connect Vercel to execute this action.',
        permissionLevel: cap.permissionLevel,
      };
    }

    let token = '';
    try {
      token = decryptCredential(conn.encrypted_credential);
    } catch {
      return {
        success: false,
        error: 'Failed to decrypt Vercel credentials. Please reconnect Vercel.',
        permissionLevel: cap.permissionLevel,
      };
    }

    try {
      let data: any;
      const teamQuery = params.teamId ? `?teamId=${encodeURIComponent(params.teamId)}` : '';

      switch (actionName) {
        case 'vercel.listTeams': {
          const res = await this.fetchVercel(token, '/v2/teams');
          data = (res.teams || []).map((t: any) => ({
            id: t.id,
            slug: t.slug,
            name: t.name,
          }));
          break;
        }

        case 'vercel.listProjects': {
          const query = params.teamId ? `?teamId=${encodeURIComponent(params.teamId)}&limit=30` : '?limit=30';
          const res = await this.fetchVercel(token, `/v9/projects${query}`);
          data = (res.projects || []).map((p: any) => ({
            id: p.id,
            name: p.name,
            framework: p.framework,
            updatedAt: p.updatedAt,
            latestDeployment: p.latestDeployments?.[0]
              ? {
                  id: p.latestDeployments[0].id,
                  url: p.latestDeployments[0].url,
                  readyState: p.latestDeployments[0].readyState,
                  createdAt: p.latestDeployments[0].createdAt,
                }
              : null,
            link: p.link
              ? {
                  type: p.link.type,
                  repo: p.link.repo,
                  org: p.link.org,
                }
              : null,
          }));
          break;
        }

        case 'vercel.getProject': {
          const { projectId } = params;
          if (!projectId) throw new Error('projectId is required');
          const res = await this.fetchVercel(token, `/v9/projects/${encodeURIComponent(projectId)}${teamQuery}`);
          data = {
            id: res.id,
            name: res.name,
            framework: res.framework,
            nodeVersion: res.nodeVersion,
            targets: res.targets,
            link: res.link,
            updatedAt: res.updatedAt,
          };
          break;
        }

        case 'vercel.listDeployments': {
          const { projectId } = params;
          let query = '?limit=15';
          if (projectId) query += `&projectId=${encodeURIComponent(projectId)}`;
          if (params.teamId) query += `&teamId=${encodeURIComponent(params.teamId)}`;

          const res = await this.fetchVercel(token, `/v6/deployments${query}`);
          data = (res.deployments || []).map((d: any) => ({
            uid: d.uid,
            name: d.name,
            url: d.url,
            state: d.state,
            created: d.created,
            creator: d.creator?.username,
            meta: {
              githubCommitMessage: d.meta?.githubCommitMessage,
              githubCommitSha: d.meta?.githubCommitSha,
              githubCommitRef: d.meta?.githubCommitRef,
            },
          }));
          break;
        }

        case 'vercel.getDeployment': {
          const { deploymentId } = params;
          if (!deploymentId) throw new Error('deploymentId is required');
          const res = await this.fetchVercel(token, `/v13/deployments/${encodeURIComponent(deploymentId)}${teamQuery}`);
          data = {
            id: res.id,
            url: res.url,
            name: res.name,
            status: res.status,
            readyState: res.readyState,
            errorCode: res.errorCode,
            errorMessage: res.errorMessage,
            createdAt: res.createdAt,
            buildingAt: res.buildingAt,
            ready: res.ready,
            meta: res.meta,
          };
          break;
        }

        case 'vercel.getDeploymentLogs': {
          const { deploymentId } = params;
          if (!deploymentId) throw new Error('deploymentId is required');
          const query = params.teamId
            ? `?limit=100&teamId=${encodeURIComponent(params.teamId)}`
            : '?limit=100';
          const rawEvents = await this.fetchVercel(
            token,
            `/v2/deployments/${encodeURIComponent(deploymentId)}/events${query}`
          );

          data = (Array.isArray(rawEvents) ? rawEvents : rawEvents.events || []).slice(-80).map((e: any) => ({
            created: e.created,
            text: e.text || e.payload?.text || '',
            type: e.type,
            step: e.step,
          }));
          break;
        }

        case 'vercel.listEnvNames': {
          // CRITICAL SECURITY RULE: NEVER REVEAL SECRET VALUES TO THE AI OR BROWSER!
          const { projectId } = params;
          if (!projectId) throw new Error('projectId is required');
          const res = await this.fetchVercel(token, `/v9/projects/${encodeURIComponent(projectId)}/env${teamQuery}`);
          data = (res.envs || []).map((env: any) => ({
            id: env.id,
            key: env.key, // Only the variable key name!
            target: env.target, // e.g. ['production', 'preview']
            type: env.type, // e.g. 'secret', 'encrypted', 'plain'
            createdAt: env.createdAt,
            updatedAt: env.updatedAt,
            // value is explicitly omitted!
          }));
          break;
        }

        case 'vercel.redeployProject': {
          const { deploymentId, name } = params;
          if (!deploymentId) throw new Error('deploymentId is required to redeploy');
          const bodyPayload: Record<string, any> = {
            deploymentId,
            name,
            target: params.target || 'production',
          };
          const res = await this.fetchVercel(token, `/v13/deployments${teamQuery}`, {
            method: 'POST',
            body: JSON.stringify(bodyPayload),
          });
          data = {
            id: res.id,
            url: res.url,
            name: res.name,
            status: res.status,
            readyState: res.readyState,
            createdAt: res.createdAt,
          };
          break;
        }

        default:
          throw new Error(`Unhandled Vercel action: ${actionName}`);
      }

      await recordAuditLog({
        userId,
        provider: 'vercel',
        action: actionName,
        resource: params.projectId || params.deploymentId,
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
      await recordAuditLog({
        userId,
        provider: 'vercel',
        action: actionName,
        resource: params.projectId || params.deploymentId,
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
