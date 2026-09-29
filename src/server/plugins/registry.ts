import { GitHubConnector } from './github-connector.ts';
import { VercelConnector } from './vercel-connector.ts';
import { SupabaseConnector } from './supabase-connector.ts';
import { GoogleDriveConnector } from './google-drive-connector.ts';
import type { Connector } from './types.ts';
import type { IntegrationProvider, IntegrationSummary, ConnectorCapability } from '../../types/index.ts';
import { db } from '../db.ts';

export class ConnectorRegistry {
  private connectors: Map<IntegrationProvider, Connector> = new Map();

  constructor() {
    this.register(new GitHubConnector());
    this.register(new VercelConnector());
    this.register(new SupabaseConnector());
    this.register(new GoogleDriveConnector());
  }

  register(connector: Connector): void {
    this.connectors.set(connector.provider, connector);
  }

  getConnector(provider: IntegrationProvider): Connector | undefined {
    return this.connectors.get(provider);
  }

  listConnectors(): Connector[] {
    return Array.from(this.connectors.values());
  }

  getAllCapabilities(): Record<IntegrationProvider, ConnectorCapability[]> {
    const result: Record<string, ConnectorCapability[]> = {};
    for (const [provider, connector] of this.connectors.entries()) {
      result[provider] = connector.listCapabilities();
    }
    return result as Record<IntegrationProvider, ConnectorCapability[]>;
  }

  async getSummaries(userId: string): Promise<IntegrationSummary[]> {
    const userConns = await db.getAllProviderConnections(userId);
    const summaries: IntegrationSummary[] = [];

    // The integrations architecture for this phase focuses on Google Drive and GitHub
    const allowedProviders: IntegrationProvider[] = ['google-drive', 'github'];

    for (const provider of allowedProviders) {
      const connector = this.connectors.get(provider);
      if (!connector) continue;

      if (provider === 'github') {
        summaries.push({
          provider: 'github',
          displayName: 'GitHub',
          description: 'GitHub repository and issue integration for AI coding tasks (Coming soon)',
          icon: 'github',
          connectionStatus: 'coming_soon',
          comingSoon: true,
          capabilities: connector.listCapabilities(),
        });
        continue;
      }

      const conn = userConns.find((c) => c.provider === connector.provider);
      let status: 'connected' | 'disconnected' | 'error' | 'expired' | 'coming_soon' = 'disconnected';

      if (conn?.connection_status === 'connected') {
        const isExpired = conn.token_expiry && new Date(conn.token_expiry).getTime() < Date.now();
        if (isExpired && !conn.encrypted_refresh_token) {
          status = 'expired';
        } else {
          status = 'connected';
        }
      } else if (conn?.connection_status === 'error') {
        status = 'error';
      }

      summaries.push({
        provider: connector.provider,
        displayName: connector.displayName,
        description: connector.description,
        icon: connector.icon,
        connectionStatus: status,
        accountUsername: conn?.account_username,
        connectedAt: conn?.updated_at,
        capabilities: connector.listCapabilities(),
        metadata: conn?.metadata
          ? {
              scopes: conn.scopes,
              hasRefreshToken: Boolean(conn.encrypted_refresh_token),
              tokenExpiry: conn.token_expiry,
              connectedAt: conn.metadata?.connectedAt,
              name: conn.metadata?.name,
              email: conn.metadata?.email,
            }
          : undefined,
      });
    }

    return summaries;
  }
}

export const connectorRegistry = new ConnectorRegistry();
