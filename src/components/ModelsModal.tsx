import React from 'react';
import { Search, X, Sparkles, Shield, Cpu } from 'lucide-react';
import { apiRequest } from '../lib/api.ts';

export interface FreeChatModel {
  id: string;
  name: string;
  description: string;
  contextLength?: number;
}

interface Usage {
  daily: { used: number; limit: number; remaining: number } | null;
}

export function ModelsModal({
  isOpen,
  onClose,
  selectedModelId,
  onSelectModel,
  isConnected,
}: {
  isOpen: boolean;
  onClose: () => void;
  selectedModelId: string | null;
  onSelectModel: (id: string | null) => void;
  isConnected: boolean;
}) {
  const [models, setModels] = React.useState<FreeChatModel[]>([]);
  const [usage, setUsage] = React.useState<Usage['daily']>(null);
  const [query, setQuery] = React.useState('');
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setError('');
    apiRequest<{ models: FreeChatModel[] }>('/api/models')
      .then((data) => {
        if (active) setModels(data.models);
      })
      .catch(() => {
        if (active) setError('Model catalog is unavailable. Try again later.');
      });

    if (isConnected) {
      apiRequest<Usage>('/api/models/usage')
        .then((data) => {
          if (active) setUsage(data.daily);
        })
        .catch(() => {
          if (active) setUsage(null);
        });
    }
    return () => {
      active = false;
    };
  }, [isOpen, isConnected]);

  if (!isOpen) return null;

  const visible = models.filter((model) =>
    `${model.name} ${model.id}`.toLowerCase().includes(query.toLowerCase())
  );

  const select = (id: string | null) => {
    onSelectModel(id);
    onClose();
  };

  const getProviderBadge = (modelId: string) => {
    if (modelId.startsWith('nvidia/')) {
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          NVIDIA
        </span>
      );
    }
    if (modelId.startsWith('google/')) {
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
          Google
        </span>
      );
    }
    if (modelId.startsWith('qwen/')) {
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
          Qwen
        </span>
      );
    }
    if (modelId.startsWith('cohere/')) {
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
          Cohere
        </span>
      );
    }
    return (
      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20">
        Free
      </span>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex justify-center items-center p-2 sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Models and Usage"
        className="w-full max-w-2xl h-[100dvh] sm:h-[88dvh] flex flex-col 
          bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md 
          sm:rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 flex items-center justify-between border-b border-zinc-200/80 dark:border-zinc-800/80">
          <div>
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h2 className="font-bold text-lg text-zinc-900 dark:text-zinc-100">
                Models & Allowance
              </h2>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Live verified free text chat models and quota tracking
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close models"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Usage & Quota Cards */}
        <div className="p-4 sm:p-5 space-y-3 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-950/40">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* ModelMesh Application Allowance */}
            <div className="p-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/80 shadow-xs">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                <Shield className="w-3.5 h-3.5 text-blue-500" />
                <span>ModelMesh application allowance</span>
              </div>
              <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200 mt-1">
                50 requests · Standard tier allowance
              </p>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                ModelMesh platform allowance for intelligent prompt routing
              </p>
            </div>

            {/* Provider Quota */}
            <div className="p-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/80 shadow-xs">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Provider quota</span>
              </div>
              {isConnected ? (
                usage ? (
                  <>
                    <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200 mt-1">
                      {usage.remaining} remaining / {usage.limit} daily free requests
                    </p>
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                      {usage.used} used today (UTC) on your OpenRouter account
                    </p>
                  </>
                ) : (
                  <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mt-1">
                    Provider-managed limit
                  </p>
                )
              ) : (
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Connect OpenRouter to inspect provider quota
                </p>
              )}
            </div>
          </div>

          {/* Search bar */}
          <label className="flex items-center gap-2 px-3 min-h-10 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus-within:border-blue-500">
            <Search className="w-4 h-4 text-zinc-400" />
            <input
              aria-label="Search free models"
              className="bg-transparent outline-none w-full text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by model name or provider (e.g. NVIDIA, Gemma, Qwen)..."
            />
          </label>
        </div>

        {/* Model List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2">
          {/* AUTO Option */}
          <button
            onClick={() => select(null)}
            className={`w-full text-left p-3.5 rounded-xl border transition-all duration-200 active:scale-[0.99]
              ${
                !selectedModelId
                  ? 'border-blue-500/50 bg-blue-50/70 dark:bg-blue-950/40 shadow-xs'
                  : 'border-zinc-200/70 dark:border-zinc-800/70 bg-white/70 dark:bg-zinc-900/70 hover:border-zinc-300 dark:hover:border-zinc-700 hover:-translate-y-0.5 hover:shadow-xs'
              }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <strong className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  Auto (Recommended)
                </strong>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  Smart Routing
                </span>
              </div>
              {!selectedModelId && (
                <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400">
                  Active
                </span>
              )}
            </div>
            <span className="block text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
              Dynamically routes prompts to specialized coding, reasoning, finance, and chat models with automated fallback.
            </span>
          </button>

          {error && (
            <p role="alert" className="p-3 text-red-500 text-xs text-center">
              {error}
            </p>
          )}
          {!error && models.length === 0 && (
            <p className="p-6 text-zinc-400 text-xs text-center">Loading model catalog...</p>
          )}
          {!error && models.length > 0 && visible.length === 0 && (
            <p className="p-6 text-zinc-400 text-xs text-center">No matching free chat models found.</p>
          )}

          {/* Model Cards with 3D lift */}
          {visible.map((model) => {
            const isSelected = selectedModelId === model.id;
            return (
              <button
                key={model.id}
                onClick={() => select(model.id)}
                className={`w-full text-left p-3.5 rounded-xl border transition-all duration-200 active:scale-[0.99]
                  ${
                    isSelected
                      ? 'border-blue-500/50 bg-blue-50/70 dark:bg-blue-950/40 shadow-xs'
                      : 'border-zinc-200/70 dark:border-zinc-800/70 bg-white/70 dark:bg-zinc-900/70 hover:border-zinc-300 dark:hover:border-zinc-700 hover:-translate-y-0.5 hover:shadow-xs'
                  }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <strong className="block text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      {model.name}
                    </strong>
                    {getProviderBadge(model.id)}
                  </div>
                  {isSelected && (
                    <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400 shrink-0">
                      Selected
                    </span>
                  )}
                </div>

                <span className="block text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 break-all font-mono text-[10px]">
                  {model.id}
                  {model.contextLength
                    ? ` · ${Math.round(model.contextLength / 1000)}K context`
                    : ''}
                </span>

                {model.description && (
                  <span className="block text-[11px] text-zinc-600 dark:text-zinc-400 mt-1.5 line-clamp-2 leading-relaxed">
                    {model.description}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
