import { db } from '../db.ts';
import { encryptCredential, decryptCredential } from '../encryption.ts';
import { recordAuditLog } from './audit.ts';
import { PermissionManager } from './permission.ts';
import type { Connector, ConnectionResult, ConnectionStatus, ActionResult } from './types.ts';
import type { ConnectorCapability } from '../../types/index.ts';

const GITHUB_API_BASE = 'https://api.github.com';

const CAPABILITIES: ConnectorCapability[] = [
  {
    name: 'github.listRepositories',
    description: 'List user repositories',
    permissionLevel: 'READ',
  },
  {
    name: 'github.searchRepositories',
    description: 'Search public/accessible repositories',
    permissionLevel: 'READ',
  },
  {
    name: 'github.readRepository',
    description: 'Read repository metadata, stars, and primary language',
    permissionLevel: 'READ',
  },
  {
    name: 'github.readBranches',
    description: 'Read branches of a repository',
    permissionLevel: 'READ',
  },
  {
    name: 'github.readFile',
    description: 'Read a file from a repository at a specific path or branch',
    permissionLevel: 'READ',
  },
  {
    name: 'github.readCommits',
    description: 'Read recent commit history of a repository',
    permissionLevel: 'READ',
  },
  {
    name: 'github.readIssues',
    description: 'Read issues from a repository',
    permissionLevel: 'READ',
  },
  {
    name: 'github.readPullRequests',
    description: 'Read pull requests from a repository',
    permissionLevel: 'READ',
  },
  {
    name: 'github.createIssue',
    description: 'Create a new issue in a repository',
    permissionLevel: 'WRITE',
    requiresConfirmation: true,
  },
  {
    name: 'github.createBranch',
    description: 'Create a new Git branch from a target commit SHA',
    permissionLevel: 'WRITE',
    requiresConfirmation: true,
  },
  {
    name: 'github.createOrUpdateFile',
    description: 'Commit a new or modified file to a repository',
    permissionLevel: 'WRITE',
    requiresConfirmation: true,
  },
  {
    name: 'github.createPullRequest',
    description: 'Open a new pull request between branches',
    permissionLevel: 'WRITE',
    requiresConfirmation: true,
  },
];

export class GitHubConnector implements Connector {
  readonly provider = 'github' as const;
  readonly displayName = 'GitHub';
  readonly description = 'Inspect repositories, commits, issues, and code directly inside hello.';
  readonly icon = 'github';

  listCapabilities(): ConnectorCapability[] {
    return CAPABILITIES;
  }

  private async fetchGitHub(token: string, endpoint: string, options: RequestInit = {}): Promise<any> {
    const res = await fetch(`${GITHUB_API_BASE}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'hello-AI-Workspace/1.0',
        ...(options.headers || {}),
      },
    });

    if (!res.ok) {
      const errBody = await res.text();
      let errorMsg = `GitHub API error: ${res.status}`;
      try {
        const parsed = JSON.parse(errBody);
        errorMsg = parsed.message || errorMsg;
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
      return { success: false, error: 'GitHub personal access token or OAuth token is required.' };
    }

    try {
      // Validate token with GitHub API
      const userProfile = await this.fetchGitHub(token, '/user');
      const username = userProfile.login;
      const providerAccountId = String(userProfile.id);

      // Encrypt and persist
      const encrypted = encryptCredential(token);
      await db.saveProviderConnection(userId, 'github', encrypted, 'connected', {
        providerAccountId,
        accountUsername: username,
        scopes: 'repo,read:org',
        metadata: {
          avatarUrl: userProfile.avatar_url,
          name: userProfile.name,
          htmlUrl: userProfile.html_url,
        },
      });

      await recordAuditLog({
        userId,
        provider: 'github',
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
        provider: 'github',
        action: 'connect',
        permissionLevel: 'WRITE',
        status: 'failed',
        details: { error: err.message },
      });
      return { success: false, error: `GitHub verification failed: ${err.message}` };
    }
  }

  async disconnect(userId: string): Promise<void> {
    await db.disconnectProvider(userId, 'github');
    await recordAuditLog({
      userId,
      provider: 'github',
      action: 'disconnect',
      permissionLevel: 'WRITE',
      status: 'success',
      approvalStatus: 'user_confirmed',
    });
  }

  async getConnectionStatus(userId: string): Promise<ConnectionStatus> {
    const conn = await db.getProviderConnection(userId, 'github');
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
        error: `Unknown action '${actionName}' for provider GitHub.`,
        permissionLevel: 'READ',
      };
    }

    // Permission evaluation
    const evalResult = PermissionManager.evaluate({
      userId,
      provider: 'github',
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

    // Retrieve decrypted token
    const conn = await db.getProviderConnection(userId, 'github');
    if (!conn || !conn.encrypted_credential) {
      return {
        success: false,
        error: 'GitHub is not connected. Please connect GitHub to execute this action.',
        permissionLevel: cap.permissionLevel,
      };
    }

    let token = '';
    try {
      token = decryptCredential(conn.encrypted_credential);
    } catch {
      return {
        success: false,
        error: 'Failed to decrypt GitHub credentials. Please reconnect GitHub.',
        permissionLevel: cap.permissionLevel,
      };
    }

    try {
      let data: any;

      switch (actionName) {
        case 'github.listRepositories': {
          const raw = await this.fetchGitHub(token, '/user/repos?per_page=30&sort=updated');
          data = raw.map((r: any) => ({
            id: r.id,
            name: r.name,
            fullName: r.full_name,
            private: r.private,
            htmlUrl: r.html_url,
            description: r.description,
            defaultBranch: r.default_branch,
            updatedAt: r.updated_at,
            language: r.language,
          }));
          break;
        }

        case 'github.searchRepositories': {
          const q = encodeURIComponent(String(params.query || '').trim());
          if (!q) throw new Error('Query parameter is required for repository search');
          const raw = await this.fetchGitHub(token, `/search/repositories?q=${q}&per_page=15`);
          data = (raw.items || []).map((r: any) => ({
            id: r.id,
            name: r.name,
            fullName: r.full_name,
            htmlUrl: r.html_url,
            description: r.description,
            stars: r.stargazers_count,
            language: r.language,
          }));
          break;
        }

        case 'github.readRepository': {
          const { owner, repo } = params;
          if (!owner || !repo) throw new Error('owner and repo are required');
          const r = await this.fetchGitHub(token, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
          data = {
            id: r.id,
            name: r.name,
            fullName: r.full_name,
            private: r.private,
            htmlUrl: r.html_url,
            description: r.description,
            stars: r.stargazers_count,
            forks: r.forks_count,
            openIssues: r.open_issues_count,
            defaultBranch: r.default_branch,
            language: r.language,
            updatedAt: r.updated_at,
          };
          break;
        }

        case 'github.readBranches': {
          const { owner, repo } = params;
          if (!owner || !repo) throw new Error('owner and repo are required');
          const raw = await this.fetchGitHub(token, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches`);
          data = raw.map((b: any) => ({
            name: b.name,
            commitSha: b.commit?.sha,
            protected: b.protected,
          }));
          break;
        }

        case 'github.readFile': {
          const { owner, repo, path: filePath, ref } = params;
          if (!owner || !repo || !filePath) throw new Error('owner, repo, and path are required');
          const query = ref ? `?ref=${encodeURIComponent(ref)}` : '';
          const res = await this.fetchGitHub(
            token,
            `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(filePath)}${query}`
          );

          if (res.type !== 'file') {
            throw new Error(`Target path '${filePath}' is a directory, not a file.`);
          }

          let content = '';
          if (res.encoding === 'base64' && res.content) {
            content = Buffer.from(res.content, 'base64').toString('utf-8');
          }

          data = {
            name: res.name,
            path: res.path,
            sha: res.sha,
            size: res.size,
            content,
          };
          break;
        }

        case 'github.readCommits': {
          const { owner, repo, ref } = params;
          if (!owner || !repo) throw new Error('owner and repo are required');
          const query = ref ? `?sha=${encodeURIComponent(ref)}&per_page=15` : '?per_page=15';
          const raw = await this.fetchGitHub(
            token,
            `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits${query}`
          );
          data = raw.map((c: any) => ({
            sha: c.sha,
            message: c.commit?.message,
            author: c.commit?.author?.name,
            date: c.commit?.author?.date,
            htmlUrl: c.html_url,
          }));
          break;
        }

        case 'github.readIssues': {
          const { owner, repo, state = 'open' } = params;
          if (!owner || !repo) throw new Error('owner and repo are required');
          const raw = await this.fetchGitHub(
            token,
            `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues?state=${encodeURIComponent(state)}&per_page=15`
          );
          data = raw
            .filter((i: any) => !i.pull_request)
            .map((i: any) => ({
              number: i.number,
              title: i.title,
              state: i.state,
              htmlUrl: i.html_url,
              user: i.user?.login,
              createdAt: i.created_at,
              body: i.body ? (i.body.length > 500 ? i.body.slice(0, 500) + '...' : i.body) : '',
            }));
          break;
        }

        case 'github.readPullRequests': {
          const { owner, repo, state = 'open' } = params;
          if (!owner || !repo) throw new Error('owner and repo are required');
          const raw = await this.fetchGitHub(
            token,
            `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls?state=${encodeURIComponent(state)}&per_page=15`
          );
          data = raw.map((p: any) => ({
            number: p.number,
            title: p.title,
            state: p.state,
            htmlUrl: p.html_url,
            head: p.head?.ref,
            base: p.base?.ref,
            createdAt: p.created_at,
          }));
          break;
        }

        case 'github.createIssue': {
          const { owner, repo, title, body } = params;
          if (!owner || !repo || !title) throw new Error('owner, repo, and title are required to create an issue');
          const res = await this.fetchGitHub(
            token,
            `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ title, body }),
            }
          );
          data = {
            number: res.number,
            title: res.title,
            htmlUrl: res.html_url,
            state: res.state,
          };
          break;
        }

        case 'github.createBranch': {
          const { owner, repo, branch, fromSha } = params;
          if (!owner || !repo || !branch || !fromSha) {
            throw new Error('owner, repo, branch, and fromSha are required');
          }
          const res = await this.fetchGitHub(
            token,
            `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/refs`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ref: `refs/heads/${branch}`,
                sha: fromSha,
              }),
            }
          );
          data = {
            ref: res.ref,
            sha: res.object?.sha,
          };
          break;
        }

        case 'github.createOrUpdateFile': {
          const { owner, repo, path: filePath, message, content, branch, sha } = params;
          if (!owner || !repo || !filePath || !message || content === undefined) {
            throw new Error('owner, repo, path, message, and content are required');
          }
          const encoded = Buffer.from(content, 'utf-8').toString('base64');
          const bodyPayload: Record<string, any> = {
            message,
            content: encoded,
          };
          if (branch) bodyPayload.branch = branch;
          if (sha) bodyPayload.sha = sha;

          const res = await this.fetchGitHub(
            token,
            `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(filePath)}`,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(bodyPayload),
            }
          );
          data = {
            content: {
              name: res.content?.name,
              path: res.content?.path,
              sha: res.content?.sha,
              htmlUrl: res.content?.html_url,
            },
            commit: {
              sha: res.commit?.sha,
              message: res.commit?.message,
            },
          };
          break;
        }

        case 'github.createPullRequest': {
          const { owner, repo, title, head, base, body } = params;
          if (!owner || !repo || !title || !head || !base) {
            throw new Error('owner, repo, title, head, and base are required to create a PR');
          }
          const res = await this.fetchGitHub(
            token,
            `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ title, head, base, body }),
            }
          );
          data = {
            number: res.number,
            title: res.title,
            htmlUrl: res.html_url,
            state: res.state,
            head: res.head?.ref,
            base: res.base?.ref,
          };
          break;
        }

        default:
          throw new Error(`Unhandled GitHub action: ${actionName}`);
      }

      await recordAuditLog({
        userId,
        provider: 'github',
        action: actionName,
        resource: params.repo ? `${params.owner}/${params.repo}` : undefined,
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
        provider: 'github',
        action: actionName,
        resource: params.repo ? `${params.owner}/${params.repo}` : undefined,
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
