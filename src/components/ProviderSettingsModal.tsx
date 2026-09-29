import React from 'react';
import {
  X,
  ShieldCheck,
  RefreshCw,
  Unplug,
  Key,
} from 'lucide-react';
import type { ProviderConnection } from '../types/index.ts';

interface ProviderSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  providerStatus: ProviderConnection | null;
  onConnectOpenRouter: () => void;
  onDisconnectOpenRouter: () => void;
  isConnecting: boolean;
  onOpenIntegrations?: () => void;
}

export const ProviderSettingsModal: React.FC<ProviderSettingsModalProps> = ({
  isOpen,
  onClose,
  providerStatus,
  onConnectOpenRouter,
  onDisconnectOpenRouter,
  isConnecting,
  onOpenIntegrations,
}) => {
  const isConnected = providerStatus?.connection_status === 'connected';

  if (!isOpen) return null;


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div role="dialog" aria-modal="true" aria-label="OpenRouter settings" className="relative w-full max-w-lg h-[100dvh] sm:h-auto sm:max-h-[90dvh] bg-white dark:bg-zinc-900 rounded-none sm:rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm">
              OR
            </div>
            <div>
              <div className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-0.5">
                Settings → Models & Routing
              </div>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                AI models & connection
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close OpenRouter settings"
            className="min-w-11 min-h-11 flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 space-y-4 min-h-0 overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]">
          <>
              {/* Status Card */}
              <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                      OpenRouter
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    {isConnected ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Connected
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                        Not connected
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-zinc-200/80 dark:border-zinc-800/80">
                  <span className="text-zinc-500">Routing Policy:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded">
                    Free models only (:free)
                  </span>
                </div>

                {isConnected && providerStatus?.updated_at && (
                  <div className="flex items-center justify-between text-[11px] text-zinc-400">
                    <span>Connected on:</span>
                    <span>{new Date(providerStatus.updated_at).toLocaleDateString()}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="pt-2">
                {isConnected ? (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={onConnectOpenRouter}
                      disabled={isConnecting}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-800 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isConnecting ? 'animate-spin' : ''}`} />
                      <span>Reconnect</span>
                    </button>
                    <button
                      onClick={onDisconnectOpenRouter}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-950/60 border border-red-200 dark:border-red-900 transition-colors"
                    >
                      <Unplug className="w-3.5 h-3.5" />
                      <span>Disconnect</span>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={onConnectOpenRouter}
                    disabled={isConnecting}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all active:scale-[0.99] disabled:opacity-50"
                  >
                    <Key className="w-4 h-4" />
                    <span>{isConnecting ? 'Opening authorization...' : 'Connect OpenRouter'}</span>
                  </button>
                )}
              </div>

              {/* Security notice */}
              <div className="p-3.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 text-xs space-y-1.5 text-zinc-600 dark:text-zinc-400">
                <div className="flex items-center gap-1.5 font-medium text-blue-700 dark:text-blue-400">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Your connection stays private</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Your OpenRouter key is encrypted on the server. You can disconnect it at any time.
                </p>
              </div>
          </>
        </div>

        {/* Footer */}
        <div className="p-4 bg-zinc-50 dark:bg-zinc-950/80 border-t border-zinc-200 dark:border-zinc-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
