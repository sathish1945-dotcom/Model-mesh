import crypto from 'crypto';
import type { PermissionLevel, ActionProposal, IntegrationProvider } from '../../types/index.ts';
import { recordAuditLog } from './audit.ts';

// In-memory proposal storage with expiration
const pendingProposals = new Map<string, ActionProposal & { userId: string; expiresAt: number }>();

// Expire pending proposals after 15 minutes
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [id, proposal] of pendingProposals.entries()) {
    if (proposal.expiresAt < now) {
      pendingProposals.delete(id);
    }
  }
}, 60 * 1000);
if (cleanupTimer.unref) {
  cleanupTimer.unref();
}

export class PermissionManager {
  /**
   * Evaluates an operation and decides whether it can proceed immediately,
   * requires confirmation, or is blocked.
   */
  static evaluate(params: {
    userId: string;
    provider: IntegrationProvider;
    action: string;
    description: string;
    permissionLevel: PermissionLevel;
    actionParams: Record<string, any>;
    isConfirmed?: boolean;
    proposalId?: string;
  }): {
    allowed: boolean;
    requiresConfirmation: boolean;
    proposal?: ActionProposal;
    reason?: string;
  } {
    const { userId, provider, action, description, permissionLevel, actionParams, isConfirmed, proposalId } = params;

    // 1. READ Level: Safe read-only operations execute automatically once connected
    if (permissionLevel === 'READ') {
      return {
        allowed: true,
        requiresConfirmation: false,
      };
    }

    // 2. WRITE and DANGEROUS Levels: require user confirmation
    if (isConfirmed && proposalId) {
      const stored = pendingProposals.get(proposalId);
      if (!stored) {
        recordAuditLog({
          userId,
          provider,
          action,
          permissionLevel,
          status: 'denied',
          approvalStatus: 'rejected',
          details: { reason: 'Proposal expired or not found' },
        });
        return {
          allowed: false,
          requiresConfirmation: true,
          reason: 'Confirmation proposal expired or invalid. Please re-trigger the action.',
        };
      }

      if (stored.userId !== userId) {
        recordAuditLog({
          userId,
          provider,
          action,
          permissionLevel,
          status: 'denied',
          approvalStatus: 'rejected',
          details: { reason: 'User mismatch for action proposal' },
        });
        return {
          allowed: false,
          requiresConfirmation: true,
          reason: 'Unauthorized: proposal belongs to a different user.',
        };
      }

      // Consumed proposal
      pendingProposals.delete(proposalId);
      return {
        allowed: true,
        requiresConfirmation: false,
        proposal: {
          ...stored,
          status: 'confirmed',
        },
      };
    }

    // Unconfirmed WRITE or DANGEROUS operation: create a pending proposal
    const newProposalId = crypto.randomUUID();
    const proposal: ActionProposal = {
      id: newProposalId,
      provider,
      action,
      description,
      permissionLevel,
      params: actionParams,
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    pendingProposals.set(newProposalId, {
      ...proposal,
      userId,
      expiresAt: Date.now() + 15 * 60 * 1000,
    });

    recordAuditLog({
      userId,
      provider,
      action,
      permissionLevel,
      status: 'pending_confirmation',
      details: {
        proposalId: newProposalId,
        description,
        params: actionParams,
      },
    });

    return {
      allowed: false,
      requiresConfirmation: true,
      proposal,
      reason: `Action requires explicit user confirmation (${permissionLevel} permission level).`,
    };
  }

  static getProposal(proposalId: string, userId: string): ActionProposal | undefined {
    const p = pendingProposals.get(proposalId);
    if (p && p.userId === userId) {
      return p;
    }
    return undefined;
  }

  static cancelProposal(proposalId: string, userId: string): boolean {
    const p = pendingProposals.get(proposalId);
    if (p && p.userId === userId) {
      pendingProposals.delete(proposalId);
      recordAuditLog({
        userId,
        provider: p.provider,
        action: p.action,
        permissionLevel: p.permissionLevel,
        status: 'denied',
        approvalStatus: 'rejected',
        details: { proposalId },
      });
      return true;
    }
    return false;
  }
}
