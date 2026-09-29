import React, { useState } from 'react';
import { AlertCircle, Check, X, ShieldAlert, ArrowRight, Loader2 } from 'lucide-react';
import type { ActionProposal } from '../types/index.ts';
import { apiRequest } from '../lib/api.ts';

interface ActionProposalCardProps {
  proposal: ActionProposal;
  onExecuted?: (result: any) => void;
  onCancelled?: () => void;
}

export const ActionProposalCard: React.FC<ActionProposalCardProps> = ({
  proposal,
  onExecuted,
  onCancelled,
}) => {
  const [status, setStatus] = useState<'pending' | 'executing' | 'confirmed' | 'cancelled' | 'error'>(
    'pending'
  );
  const [resultData, setResultData] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleConfirm = async () => {
    try {
      setStatus('executing');
      setErrorMessage(null);

      const data = await apiRequest<{ success: boolean; data?: any; error?: string }>(
        `/api/integrations/proposals/${proposal.id}/confirm`,
        { method: 'POST' }
      );

      if (!data.success) {
        throw new Error(data.error || 'Execution failed.');
      }

      setStatus('confirmed');
      setResultData(data.data);
      if (onExecuted) onExecuted(data.data);
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err.message || 'Action execution failed.');
    }
  };

  const handleCancel = async () => {
    try {
      await apiRequest(`/api/integrations/proposals/${proposal.id}/cancel`, { method: 'POST' });
      setStatus('cancelled');
      if (onCancelled) onCancelled();
    } catch {
      setStatus('cancelled');
    }
  };

  return (
    <div className="my-3 p-4 rounded-2xl border border-amber-300 dark:border-amber-800/80 bg-amber-50/60 dark:bg-amber-950/20 text-zinc-900 dark:text-zinc-100 text-xs shadow-xs space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-400">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-zinc-900 dark:text-zinc-100">
              Action Approval Required ({proposal.permissionLevel})
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {proposal.description || `Execute ${proposal.action} on ${proposal.provider}`}
            </div>
          </div>
        </div>

        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase bg-amber-200 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300">
          {proposal.provider}
        </span>
      </div>

      {/* Parameter Details */}
      <div className="bg-white/80 dark:bg-zinc-900/80 p-2.5 rounded-xl border border-amber-200/80 dark:border-amber-900/40 font-mono text-[11px] overflow-x-auto">
        <div className="text-[10px] text-zinc-400 font-sans uppercase font-semibold mb-1">
          Proposed Parameters:
        </div>
        <pre className="whitespace-pre-wrap">{JSON.stringify(proposal.params, null, 2)}</pre>
      </div>

      {/* Status Messages */}
      {status === 'confirmed' && (
        <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40 space-y-1">
          <div className="flex items-center gap-1.5 font-medium">
            <Check className="w-4 h-4" />
            <span>Action executed successfully!</span>
          </div>
          {resultData && (
            <pre className="text-[10px] font-mono whitespace-pre-wrap bg-white/40 dark:bg-zinc-900/40 p-1.5 rounded-md">
              {JSON.stringify(resultData, null, 2)}
            </pre>
          )}
        </div>
      )}

      {status === 'cancelled' && (
        <div className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
          <X className="w-4 h-4" />
          <span>Action rejected and cancelled by user.</span>
        </div>
      )}

      {status === 'error' && (
        <div className="p-2 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/40 flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4" />
          <span>{errorMessage || 'Execution failed'}</span>
        </div>
      )}

      {/* Buttons */}
      {status === 'pending' && (
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            onClick={handleCancel}
            className="px-3 py-1.5 rounded-xl text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/50 dark:hover:bg-zinc-800 font-medium transition-colors"
          >
            Reject
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
          >
            <span>Confirm & Execute</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {status === 'executing' && (
        <div className="flex items-center justify-end gap-2 text-blue-600 dark:text-blue-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Executing with provider API...</span>
        </div>
      )}
    </div>
  );
};
