import type {
  IntegrationProvider,
  ConnectorCapability,
  PermissionLevel,
  AuditLogEntry,
  ActionProposal,
} from '../../types/index.ts';

export interface ConnectionResult {
  success: boolean;
  accountUsername?: string;
  providerAccountId?: string;
  scopes?: string;
  metadata?: Record<string, any>;
  error?: string;
}

export interface ConnectionStatus {
  connected: boolean;
  accountUsername?: string;
  providerAccountId?: string;
  scopes?: string;
  error?: string;
  connectedAt?: string;
}

export interface ActionResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  requiresConfirmation?: boolean;
  permissionLevel: PermissionLevel;
  proposal?: ActionProposal;
}

export interface Connector {
  readonly provider: IntegrationProvider;
  readonly displayName: string;
  readonly description: string;
  readonly icon: string;

  listCapabilities(): ConnectorCapability[];
  connect(userId: string, credentials: Record<string, any>): Promise<ConnectionResult>;
  disconnect(userId: string): Promise<void>;
  getConnectionStatus(userId: string): Promise<ConnectionStatus>;
  executeAction(
    userId: string,
    actionName: string,
    params: Record<string, any>,
    isConfirmed?: boolean,
    proposalId?: string
  ): Promise<ActionResult>;
  refreshCredentials?(userId: string): Promise<void>;
}
