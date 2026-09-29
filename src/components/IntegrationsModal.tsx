import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Github,
  Triangle,
  Database,
  ShieldCheck,
  ExternalLink,
  RefreshCw,
  Clock,
  Key,
  Trash2,
  Terminal,
  Settings2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Lock,
} from 'lucide-react';
import type { IntegrationSummary, AuditLogEntry, IntegrationProvider } from '../types/index.ts';
import { apiRequest } from '../lib/api.ts';

const GoogleDriveIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
    <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
    <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47"/>
    <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
    <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
    <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
    <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
  </svg>
);

interface IntegrationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAuth?: () => void;
  isAuthenticated: boolean;
}

export const IntegrationsModal: React.FC<IntegrationsModalProps> = ({
  isOpen,
  onClose,
  onOpenAuth,
  isAuthenticated,
}) => {
  const [activeTab, setActiveTab] = useState<'connectors' | 'audit'>('connectors');
  const [integrations, setIntegrations] = useState<IntegrationSummary[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [connectingProvider, setConnectingProvider] = useState<IntegrationProvider | null>(null);
  const [managingProvider, setManagingProvider] = useState<IntegrationSummary | null>(null);
  const [isConnectingGoogleDrive, setIsConnectingGoogleDrive] = useState(false);
  const [showManualDriveAuth, setShowManualDriveAuth] = useState(false);

  const [tokenInput, setTokenInput] = useState('');
  const [refreshTokenInput, setRefreshTokenInput] = useState('');
  const [projectUrlInput, setProjectUrlInput] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [showAdvancedScopes, setShowAdvancedScopes] = useState(false);

  useEffect(() => {
    if (isOpen && isAuthenticated) {
      fetchIntegrations();
      fetchAuditLogs();
    }
  }, [isOpen, isAuthenticated]);

  // Listen for Google Drive OAuth popup messages
  useEffect(() => {
    const handleOAuthMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GOOGLE_DRIVE_OAUTH_SUCCESS') {
        setIsConnectingGoogleDrive(false);
        setActionSuccess(event.data.message || 'Google Drive connected successfully!');
        setConnectingProvider(null);
        fetchIntegrations();
        fetchAuditLogs();
      } else if (event.data?.type === 'GOOGLE_DRIVE_OAUTH_ERROR') {
        setIsConnectingGoogleDrive(false);
        setActionError(event.data.message || 'Google Drive authorization was denied or failed.');
        setConnectingProvider(null);
      }
    };
    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, []);

  const fetchIntegrations = async () => {
    try {
      setIsLoading(true);
      const data = await apiRequest<{ integrations: IntegrationSummary[] }>('/api/integrations');
      setIntegrations(data.integrations || []);
    } catch (err) {
      console.error('Failed to load integrations:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const data = await apiRequest<{ logs: AuditLogEntry[] }>('/api/integrations/audit-logs');
      setAuditLogs(data.logs || []);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    }
  };

  const handleOpenConnect = (provider: IntegrationProvider) => {
    setConnectingProvider(provider);
    setManagingProvider(null);
    setTokenInput('');
    setRefreshTokenInput('');
    setProjectUrlInput('');
    setApiKeyInput('');
    setActionError(null);
    setActionSuccess(null);
    setShowManualDriveAuth(false);
  };

  const handleConnectGoogleDrivePopup = () => {
    setIsConnectingGoogleDrive(true);
    setActionError(null);
    setActionSuccess(null);
    const width = 500;
    const height = 650;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    const popup = window.open(
      '/api/integrations/google-drive/connect',
      'GoogleDriveOAuth',
      `width=${width},height=${height},left=${left},top=${top},status=no,toolbar=no,menubar=no`
    );

    const checkClosed = setInterval(() => {
      if (popup && popup.closed) {
        clearInterval(checkClosed);
        setTimeout(() => {
          setIsConnectingGoogleDrive(false);
          fetchIntegrations();
        }, 1200);
      }
    }, 1000);
  };

  const handleConnectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connectingProvider) return;

    setActionError(null);
    setActionSuccess(null);
    setIsLoading(true);

    try {
      const payload: Record<string, any> = {};
      if (connectingProvider === 'github' || connectingProvider === 'vercel') {
        if (!tokenInput.trim()) {
          setActionError('Personal access token is required.');
          setIsLoading(false);
          return;
        }
        payload.token = tokenInput.trim();
      } else if (connectingProvider === 'supabase') {
        if (tokenInput.trim()) {
          payload.token = tokenInput.trim();
        } else if (projectUrlInput.trim() && apiKeyInput.trim()) {
          payload.projectUrl = projectUrlInput.trim();
          payload.apiKey = apiKeyInput.trim();
        } else {
          setActionError('Please provide either a Management Token or Project URL + API Key.');
          setIsLoading(false);
          return;
        }
      } else if (connectingProvider === 'google-drive') {
        if (!tokenInput.trim()) {
          setActionError('Google OAuth access token is required.');
          setIsLoading(false);
          return;
        }
        payload.accessToken = tokenInput.trim();
        if (refreshTokenInput.trim()) {
          payload.refreshToken = refreshTokenInput.trim();
        }
      }

      await apiRequest(`/api/integrations/${connectingProvider}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      setActionSuccess(`${connectingProvider.replace('-', ' ').toUpperCase()} connected successfully!`);
      setConnectingProvider(null);
      setTokenInput('');
      setRefreshTokenInput('');
      setProjectUrlInput('');
      setApiKeyInput('');
      fetchIntegrations();
      fetchAuditLogs();
    } catch (err: any) {
      setActionError(err.message || 'Connection failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async (provider: IntegrationProvider) => {
    if (!confirm(`Are you sure you want to disconnect ${provider}?`)) return;

    try {
      setIsLoading(true);
      await apiRequest(`/api/integrations/${provider}/disconnect`, { method: 'POST' });
      setActionSuccess(`${provider.replace('-', ' ').toUpperCase()} disconnected.`);
      if (managingProvider?.provider === provider) {
        setManagingProvider(null);
      }
      fetchIntegrations();
      fetchAuditLogs();
    } catch (err: any) {
      console.error('Failed to disconnect:', err);
      setActionError(err.message || 'Failed to disconnect');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const getProviderIcon = (provider: IntegrationProvider) => {
    switch (provider) {
      case 'github':
        return <Github className="w-5 h-5 text-zinc-900 dark:text-zinc-100" />;
      case 'vercel':
        return <Triangle className="w-5 h-5 text-black dark:text-white fill-current" />;
      case 'supabase':
        return <Database className="w-5 h-5 text-emerald-500" />;
      case 'google-drive':
        return <GoogleDriveIcon className="w-5 h-5" />;
      default:
        return <Key className="w-5 h-5 text-blue-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-3xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1.5 mb-0.5">
                <span>Settings</span>
                <span className="text-zinc-400 dark:text-zinc-600">→</span>
                <span>Integrations</span>
              </div>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Integrations
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Manage external integrations with AES-256-GCM encrypted token storage
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 px-5">
          <button
            onClick={() => {
              setActiveTab('connectors');
              setManagingProvider(null);
            }}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'connectors'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            <span>Integrations</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
              {integrations.filter((i) => i.connectionStatus === 'connected').length} / {integrations.length}
            </span>
          </button>
          <button
            onClick={() => {
              setActiveTab('audit');
              setManagingProvider(null);
            }}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'audit'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Audit Log</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
              {auditLogs.length}
            </span>
          </button>
        </div>

        {/* Global Feedback Banners */}
        {actionSuccess && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40 text-xs flex items-center justify-between">
            <span>{actionSuccess}</span>
            <button onClick={() => setActionSuccess(null)} className="font-bold opacity-70 hover:opacity-100">✕</button>
          </div>
        )}
        {actionError && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/40 text-xs flex items-center justify-between">
            <span>{actionError}</span>
            <button onClick={() => setActionError(null)} className="font-bold opacity-70 hover:opacity-100">✕</button>
          </div>
        )}

        {/* Body Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {!isAuthenticated ? (
            <div className="text-center py-10 space-y-3">
              <ShieldCheck className="w-10 h-10 text-zinc-400 mx-auto" />
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Please sign in to connect and manage developer tools.
              </p>
              {onOpenAuth && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenAuth();
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs"
                >
                  Sign In
                </button>
              )}
            </div>
          ) : activeTab === 'connectors' ? (
            <div className="space-y-4">
              {/* Manage Provider Modal/View */}
              {managingProvider && (
                <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getProviderIcon(managingProvider.provider)}
                      <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        Manage {managingProvider.displayName}
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setManagingProvider(null)}
                      className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                    >
                      Close
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-1">
                      <span className="text-[10px] text-zinc-400 font-semibold uppercase">
                        Connected Account
                      </span>
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {managingProvider.accountUsername ? `@${managingProvider.accountUsername}` : 'Authenticated Account'}
                      </div>
                      <div className="text-[11px] text-zinc-500">
                        Status: <span className="text-emerald-600 dark:text-emerald-400 font-medium">Active & Verified</span>
                      </div>
                    </div>

                    <div className="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-1">
                      <span className="text-[10px] text-zinc-400 font-semibold uppercase">
                        Security & Storage
                      </span>
                      <div className="flex items-center gap-1.5 text-zinc-800 dark:text-zinc-200 font-medium">
                        <Lock className="w-3.5 h-3.5 text-emerald-500" />
                        <span>AES-256-GCM Encrypted</span>
                      </div>
                      <div className="text-[11px] text-zinc-500">
                        Tokens never exposed to browser client
                      </div>
                    </div>
                  </div>

                  {/* Advanced OAuth Section */}
                  <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-800/60">
                    <button
                      type="button"
                      onClick={() => setShowAdvancedScopes(!showAdvancedScopes)}
                      className="flex items-center gap-1 text-[11px] font-semibold text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                    >
                      {showAdvancedScopes ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      <span>{showAdvancedScopes ? 'Hide Advanced OAuth Configuration' : 'Show Advanced OAuth Details'}</span>
                    </button>

                    {showAdvancedScopes && (
                      <div className="mt-2 p-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-2 text-xs font-mono">
                        <div>
                          <span className="text-[10px] text-zinc-400 uppercase font-sans font-semibold">Granted OAuth Scope:</span>
                          <div className="text-[11px] text-blue-600 dark:text-blue-400 bg-zinc-50 dark:bg-zinc-800/60 p-1.5 rounded-lg break-all">
                            {managingProvider.metadata?.scopes || 'https://www.googleapis.com/auth/drive.file'}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] font-sans">
                          <div>
                            <span className="text-zinc-400">Token Refresh:</span>{' '}
                            <span className="text-emerald-600 font-semibold">Automatic via Refresh Token</span>
                          </div>
                          <div>
                            <span className="text-zinc-400">Scope Policy:</span>{' '}
                            <span className="text-zinc-700 dark:text-zinc-300 font-semibold">Least Privilege (drive.file)</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <button
                      type="button"
                      onClick={() => handleDisconnect(managingProvider.provider)}
                      className="px-3 py-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 border border-red-200 dark:border-red-900/40 rounded-xl transition-colors font-medium flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Disconnect Provider</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setManagingProvider(null)}
                      className="px-4 py-1.5 bg-zinc-900 hover:bg-black dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 rounded-xl text-xs font-medium transition-colors"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}

              {/* Connection Dialog Box if active */}
              {connectingProvider && (
                <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getProviderIcon(connectingProvider)}
                      <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 capitalize">
                        Connect {connectingProvider.replace('-', ' ')}
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setConnectingProvider(null)}
                      className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                    >
                      Cancel
                    </button>
                  </div>

                  {connectingProvider === 'google-drive' ? (
                    /* Google Drive OAuth Flow UI */
                    <div className="space-y-3">
                      <p className="text-xs text-zinc-600 dark:text-zinc-400">
                        Authorize ModelMesh to access files you create or choose with Google Drive. We strictly use the narrowest scope (<code className="text-blue-600 font-mono">drive.file</code>) to protect your account.
                      </p>

                      <div className="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-2">
                        <button
                          type="button"
                          onClick={handleConnectGoogleDrivePopup}
                          disabled={isConnectingGoogleDrive}
                          className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors"
                        >
                          {isConnectingGoogleDrive ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>Authorizing with Google...</span>
                            </>
                          ) : (
                            <>
                              <GoogleDriveIcon className="w-4 h-4" />
                              <span>Authorize with Google Account</span>
                            </>
                          )}
                        </button>
                        <p className="text-[11px] text-zinc-400 text-center">
                          A secure Google OAuth consent dialog will open in a popup window.
                        </p>
                      </div>

                      {/* Manual Token Option for Dev/Sandbox */}
                      <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-800/60">
                        <button
                          type="button"
                          onClick={() => setShowManualDriveAuth(!showManualDriveAuth)}
                          className="text-[11px] text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 font-medium flex items-center gap-1"
                        >
                          {showManualDriveAuth ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          <span>Developer / Manual Token Option</span>
                        </button>

                        {showManualDriveAuth && (
                          <form onSubmit={handleConnectSubmit} className="mt-2 space-y-2">
                            <div>
                              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                Google OAuth Access Token
                              </label>
                              <input
                                type="password"
                                value={tokenInput}
                                onChange={(e) => setTokenInput(e.target.value)}
                                placeholder="ya29.a0AfH6SM..."
                                className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:border-blue-500 font-mono"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                Google OAuth Refresh Token (Optional for auto-refresh)
                              </label>
                              <input
                                type="password"
                                value={refreshTokenInput}
                                onChange={(e) => setRefreshTokenInput(e.target.value)}
                                placeholder="1//04..."
                                className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:border-blue-500 font-mono"
                              />
                            </div>
                            <div className="flex justify-end gap-2 pt-1">
                              <button
                                type="submit"
                                disabled={isLoading}
                                className="px-4 py-1.5 bg-zinc-900 hover:bg-black dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-medium rounded-xl shadow-xs transition-colors"
                              >
                                {isLoading ? 'Encrypting & Saving...' : 'Save & Encrypt'}
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* GitHub Token Form */
                    <form onSubmit={handleConnectSubmit} className="space-y-3">
                      <p className="text-xs text-zinc-600 dark:text-zinc-400">
                        Credentials are stored server-side under AES-256-GCM encryption and are never exposed to browser client JavaScript.
                      </p>

                      {connectingProvider === 'github' && (
                        <div>
                          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                            Personal Access Token (classic or fine-grained with <code className="text-pink-600">repo</code> scope)
                          </label>
                          <input
                            type="password"
                            value={tokenInput}
                            onChange={(e) => setTokenInput(e.target.value)}
                            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                            className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:border-blue-500 font-mono"
                            required
                          />
                        </div>
                      )}

                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setConnectingProvider(null)}
                          className="px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200/50 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isLoading}
                          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium rounded-xl shadow-xs transition-colors"
                        >
                          {isLoading ? 'Verifying...' : 'Save & Encrypt'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* Cards List */}
              <div className="grid grid-cols-1 gap-4">
                {integrations
                  .filter((item) => item.provider === 'google-drive' || item.provider === 'github')
                  .map((item) => {
                    const isConnected = item.connectionStatus === 'connected';
                    const isExpired = item.connectionStatus === 'expired';
                    const isError = item.connectionStatus === 'error';
                    const isComingSoon = item.provider === 'github' || item.comingSoon || item.connectionStatus === 'coming_soon';
                    const isConnecting = isConnectingGoogleDrive && item.provider === 'google-drive';

                    return (
                      <div
                        key={item.provider}
                        className={`p-4 rounded-2xl border transition-all ${
                          isConnected
                            ? 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30'
                            : isExpired
                            ? 'border-amber-200 dark:border-amber-900/40 bg-amber-50/20 dark:bg-amber-950/10'
                            : isError
                            ? 'border-red-200 dark:border-red-900/40 bg-red-50/20 dark:bg-red-950/10'
                            : isComingSoon
                            ? 'border-zinc-200 dark:border-zinc-800/60 bg-zinc-50/30 dark:bg-zinc-900/20 opacity-95'
                            : 'border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/10'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-2xs">
                              {getProviderIcon(item.provider)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                  {item.displayName}
                                </h3>

                                {/* State Badges: Coming soon, Connected, Connecting, Expired, Error, Not connected */}
                                {isComingSoon ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800/40">
                                    <span>Coming soon</span>
                                  </span>
                                ) : isConnected ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                    <span>Connected</span>
                                  </span>
                                ) : isConnecting ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/40">
                                    <RefreshCw className="w-3 h-3 text-blue-500 animate-spin" />
                                    <span>Connecting</span>
                                  </span>
                                ) : isExpired ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/40">
                                    <AlertTriangle className="w-3 h-3 text-amber-500" />
                                    <span>Connection expired</span>
                                  </span>
                                ) : isError ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/40">
                                    <AlertCircle className="w-3 h-3 text-red-500" />
                                    <span>Error</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700">
                                    <XCircle className="w-3 h-3 text-zinc-400" />
                                    <span>Not connected</span>
                                  </span>
                                )}
                              </div>

                              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                                {item.description}
                              </p>

                              {isConnected && item.accountUsername && (
                                <p className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 mt-1">
                                  Connected Google Account:{' '}
                                  <span className="text-blue-600 dark:text-blue-400 font-semibold">
                                    @{item.accountUsername}
                                  </span>
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="shrink-0 flex items-center gap-2">
                            {isComingSoon ? (
                              <button
                                disabled
                                className="px-3.5 py-1.5 text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 rounded-xl font-medium cursor-not-allowed border border-zinc-200 dark:border-zinc-700 shadow-none"
                              >
                                Coming soon
                              </button>
                            ) : isConnected ? (
                              <>
                                <button
                                  onClick={() => setManagingProvider(item)}
                                  className="px-3 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl transition-colors font-medium flex items-center gap-1.5"
                                >
                                  <Settings2 className="w-3.5 h-3.5" />
                                  <span>Manage</span>
                                </button>
                                <button
                                  onClick={() => handleDisconnect(item.provider)}
                                  className="px-3 py-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 border border-red-200 dark:border-red-900/40 rounded-xl transition-colors font-medium flex items-center gap-1.5"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Disconnect</span>
                                </button>
                              </>
                            ) : isExpired || isError ? (
                              <>
                                <button
                                  onClick={() => handleOpenConnect(item.provider)}
                                  className="px-3 py-1.5 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-medium shadow-xs transition-colors"
                                >
                                  Reconnect
                                </button>
                                <button
                                  onClick={() => handleDisconnect(item.provider)}
                                  className="px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-700 border border-zinc-200 dark:border-zinc-700 rounded-xl transition-colors font-medium"
                                >
                                  Clear
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => handleOpenConnect(item.provider)}
                                className="px-4 py-1.5 text-xs bg-zinc-900 hover:bg-black dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 rounded-xl font-medium shadow-xs transition-colors"
                              >
                                Connect
                              </button>
                            )}
                          </div>
                        </div>

                      {/* Capabilities Checklist */}
                      <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800/60">
                        <div className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2">
                          Granted Capabilities & Permission Levels
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {item.capabilities.map((cap) => (
                            <div
                              key={cap.name}
                              className="flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400 bg-white/60 dark:bg-zinc-800/40 px-2.5 py-1.5 rounded-lg border border-zinc-100 dark:border-zinc-800"
                            >
                              <div className="flex items-center gap-1.5 truncate pr-2">
                                <span className="text-emerald-500 text-xs font-bold">✓</span>
                                <span className="truncate">{cap.description}</span>
                              </div>
                              <span
                                className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-semibold uppercase ${
                                  cap.permissionLevel === 'READ'
                                    ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400'
                                    : cap.permissionLevel === 'WRITE'
                                    ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400'
                                    : 'bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400'
                                }`}
                                title={cap.requiresConfirmation ? 'Requires explicit user confirmation' : 'Safe read-only execution'}
                              >
                                {cap.permissionLevel}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Audit Log View */
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                <span>Recent plugin & developer tool execution records</span>
                <button
                  onClick={fetchAuditLogs}
                  className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh</span>
                </button>
              </div>

              {auditLogs.length === 0 ? (
                <div className="text-center py-8 text-xs text-zinc-400">
                  No plugin activity recorded yet.
                </div>
              ) : (
                <div className="divide-y divide-zinc-200 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden text-xs">
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 bg-white dark:bg-zinc-900/60 flex items-start justify-between gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-zinc-900 dark:text-zinc-100 font-mono">
                            {log.action}
                          </span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] uppercase font-mono font-medium ${
                              log.status === 'success'
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600'
                                : log.status === 'pending_confirmation'
                                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600'
                                : 'bg-red-50 dark:bg-red-950/40 text-red-600'
                            }`}
                          >
                            {log.status}
                          </span>
                          <span className="text-[10px] text-zinc-400 uppercase">
                            {log.provider}
                          </span>
                        </div>

                        {log.resource && (
                          <div className="text-zinc-500 dark:text-zinc-400">
                            Resource: <span className="font-mono text-zinc-700 dark:text-zinc-300">{log.resource}</span>
                          </div>
                        )}

                        {log.details && Object.keys(log.details).length > 0 && (
                          <div className="text-[11px] text-zinc-400 font-mono">
                            {JSON.stringify(log.details)}
                          </div>
                        )}
                      </div>

                      <div className="text-[11px] text-zinc-400 whitespace-nowrap flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(log.created_at).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
