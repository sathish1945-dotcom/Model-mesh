import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  RefreshCw,
  Unplug,
  Key,
  Info,
  Lock,
  Cpu,
} from 'lucide-react';
import type { ProviderConnection } from '../types/index.ts';

interface ProviderSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  providerStatus: ProviderConnection | null;
  onConnectOpenRouter: () => void;
  onDisconnectOpenRouter: () => void;
  appUrl: string;
  isConnecting: boolean;
  onOpenIntegrations?: () => void;
}

export const ProviderSettingsModal: React.FC<ProviderSettingsModalProps> = ({
  isOpen,
  onClose,
  providerStatus,
  onConnectOpenRouter,
  onDisconnectOpenRouter,
  appUrl,
  isConnecting,
  onOpenIntegrations,
}) => {
  const [activeTab, setActiveTab] = useState<'status' | 'env' | 'flow'>('status');
  const isConnected = providerStatus?.connection_status === 'connected';

  if (!isOpen) return null;

  const callbackUrl = `${appUrl}/api/openrouter/callback`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col">
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
                OpenRouter Connection
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab navigation */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 px-5 text-xs font-medium items-center justify-between">
          <div className="flex">
            <button
              onClick={() => setActiveTab('status')}
              className={`py-2.5 border-b-2 transition-colors mr-4 ${
                activeTab === 'status'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              Connection Status
            </button>
            <button
              onClick={() => setActiveTab('env')}
              className={`py-2.5 border-b-2 transition-colors mr-4 ${
                activeTab === 'env'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              Environment Variables
            </button>
            <button
              onClick={() => setActiveTab('flow')}
              className={`py-2.5 border-b-2 transition-colors ${
                activeTab === 'flow'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              PKCE Architecture
            </button>
          </div>

          {onOpenIntegrations && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenIntegrations();
              }}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-semibold py-1 ml-2 shrink-0"
              title="Navigate to Settings → Integrations"
            >
              <span>Integrations</span>
              <span>→</span>
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {activeTab === 'status' && (
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
                  <span>PKCE Zero-Paste Security</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  We use OpenRouter's official OAuth PKCE flow without requiring any client secrets. Your returned key is encrypted on the server with AES-256-GCM and never exposed to the frontend or browser.
                </p>
              </div>
            </>
          )}

          {activeTab === 'env' && (
            <div className="space-y-4 text-xs">
              <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-2">
                <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-blue-500" />
                  <span>Required Environment Variables</span>
                </div>
                <p className="text-zinc-500 dark:text-zinc-400 text-[11px] leading-relaxed">
                  OpenRouter OAuth PKCE does <strong>not</strong> require <code className="text-zinc-400">OPENROUTER_CLIENT_ID</code> or <code className="text-zinc-400">OPENROUTER_CLIENT_SECRET</code>. Only the following variables are used:
                </p>
              </div>

              <div className="space-y-2.5">
                <div className="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50">
                  <div className="flex items-center justify-between font-mono text-[11px] font-semibold text-zinc-800 dark:text-zinc-200">
                    <span>AUTH_SECRET</span>
                    <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">Required</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                    Secret key used for signing and verifying user session tokens.
                  </p>
                </div>

                <div className="p-2.5 rounded-lg border border-blue-200/80 dark:border-blue-900/60 bg-blue-50/20 dark:bg-blue-950/20">
                  <div className="flex items-center justify-between font-mono text-[11px] font-semibold text-blue-700 dark:text-blue-400">
                    <span>APP_ENCRYPTION_KEY</span>
                    <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">Required (32-byte Base64)</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                    Base64-encoded 32-byte AES key used for server-side AES-256-GCM encryption of connected OpenRouter keys. Validated at server boot.
                  </p>
                  <p className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 mt-1.5">
                    Generate: openssl rand -base64 32
                  </p>
                </div>

                <div className="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50">
                  <div className="flex items-center justify-between font-mono text-[11px] font-semibold text-zinc-800 dark:text-zinc-200">
                    <span>GOOGLE_CLIENT_ID</span>
                    <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">Optional</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                    Optional Google OAuth Client ID for Google Sign In.
                  </p>
                </div>

                <div className="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50">
                  <div className="flex items-center justify-between font-mono text-[11px] font-semibold text-zinc-800 dark:text-zinc-200">
                    <span>DATABASE_URL</span>
                    <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">Optional</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                    Optional PostgreSQL connection string. Defaults to local persistent JSON store.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'flow' && (
            <div className="space-y-4 text-xs">
              <div className="p-3.5 bg-zinc-50 dark:bg-zinc-950/60 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-2">
                <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-blue-500" />
                  <span>Configured Callback URL</span>
                </div>
                <div className="p-2 bg-zinc-100 dark:bg-zinc-800 font-mono text-[11px] rounded break-all select-all text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">
                  {callbackUrl}
                </div>
              </div>

              <div className="space-y-2 text-zinc-600 dark:text-zinc-400 text-[11px] leading-relaxed">
                <div className="font-semibold text-zinc-800 dark:text-zinc-200 text-xs">
                  Official OpenRouter PKCE Sequence:
                </div>
                <ol className="list-decimal pl-4 space-y-1.5">
                  <li><strong>Generate Verifier:</strong> Backend generates a secure random 32-byte <code className="text-blue-500">code_verifier</code>.</li>
                  <li><strong>Generate Challenge:</strong> Backend computes SHA-256 hash (<code className="text-blue-500">S256 code_challenge</code>).</li>
                  <li><strong>Redirect:</strong> User is sent to <code className="text-blue-500">https://openrouter.ai/auth</code> with callback URL, challenge, and method.</li>
                  <li><strong>Callback:</strong> OpenRouter delivers the authorization code to <code className="text-blue-500">/api/openrouter/callback</code>.</li>
                  <li><strong>Key Exchange:</strong> Backend exchanges <code className="text-blue-500">code + code_verifier</code> at <code className="text-blue-500">https://openrouter.ai/api/v1/auth/keys</code>.</li>
                  <li><strong>Encryption:</strong> Key is encrypted with AES-256-GCM using <code className="text-blue-500">APP_ENCRYPTION_KEY</code> and stored linked exclusively to that user.</li>
                </ol>
              </div>
            </div>
          )}
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
