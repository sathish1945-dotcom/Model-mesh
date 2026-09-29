import React from 'react';
import { Search, X } from 'lucide-react';
import { apiRequest } from '../lib/api.ts';

export interface FreeChatModel { id: string; name: string; description: string; contextLength?: number }
interface Usage { daily: { used: number; limit: number; remaining: number } | null }

export function ModelsModal({ isOpen, onClose, selectedModelId, onSelectModel, isConnected }: {
  isOpen: boolean; onClose: () => void; selectedModelId: string | null;
  onSelectModel: (id: string | null) => void; isConnected: boolean;
}) {
  const [models, setModels] = React.useState<FreeChatModel[]>([]);
  const [usage, setUsage] = React.useState<Usage['daily']>(null);
  const [query, setQuery] = React.useState('');
  const [error, setError] = React.useState('');
  React.useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setError('');
    apiRequest<{ models: FreeChatModel[] }>('/api/models').then((data) => { if (active) setModels(data.models); })
      .catch(() => { if (active) setError('Model catalog is unavailable. Try again later.'); });
    if (isConnected) apiRequest<Usage>('/api/models/usage').then((data) => { if (active) setUsage(data.daily); })
      .catch(() => { if (active) setUsage(null); });
    return () => { active = false; };
  }, [isOpen, isConnected]);
  if (!isOpen) return null;
  const visible = models.filter((model) => `${model.name} ${model.id}`.toLowerCase().includes(query.toLowerCase()));
  const select = (id: string | null) => { onSelectModel(id); onClose(); };
  return <div className="fixed inset-0 z-50 bg-black/60 flex justify-center items-center p-0 sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div role="dialog" aria-modal="true" aria-label="Models" className="w-full max-w-2xl h-[100dvh] sm:h-[85dvh] flex flex-col bg-white dark:bg-zinc-900 sm:rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl">
      <div className="p-4 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800">
        <div><h2 className="font-semibold text-lg">Models</h2><p className="text-xs text-zinc-500">Free text chat models currently listed by OpenRouter</p></div>
        <button onClick={onClose} aria-label="Close models" className="min-w-11 min-h-11 grid place-items-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"><X className="w-5 h-5" /></button>
      </div>
      <div className="p-4 space-y-3 border-b border-zinc-200 dark:border-zinc-800">
        {isConnected && <div className="text-sm rounded-xl bg-blue-50 dark:bg-blue-950/40 p-3 text-blue-800 dark:text-blue-200">
          {usage ? <><strong>Daily free requests: {usage.remaining} remaining / {usage.limit}</strong><span className="block text-xs mt-1">{usage.used} used today (UTC). Shared across free models on your OpenRouter account.</span></> : 'Daily usage is unavailable from OpenRouter right now.'}
        </div>}
        <p className="text-xs text-zinc-500">OpenRouter does not report a reliable remaining-request counter for each model. Providers may temporarily rate-limit even when your daily requests remain.</p>
        <label className="flex items-center gap-2 px-3 min-h-11 rounded-xl border border-zinc-200 dark:border-zinc-700"><Search className="w-4 h-4 text-zinc-400" /><input aria-label="Search free models" className="bg-transparent outline-none w-full text-sm" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search free models" /></label>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        <button onClick={() => select(null)} className={`w-full text-left p-3 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 ${!selectedModelId ? 'bg-blue-50 dark:bg-blue-950/40' : ''}`}><strong className="text-sm">Auto (recommended)</strong><span className="block text-xs text-zinc-500">Choose a suitable free model for each prompt, with fallbacks.</span></button>
        {error && <p role="alert" className="p-3 text-red-500 text-sm">{error}</p>}
        {!error && models.length === 0 && <p className="p-3 text-zinc-500 text-sm">Loading models…</p>}
        {!error && models.length > 0 && visible.length === 0 && <p className="p-3 text-zinc-500 text-sm">No matching free chat models.</p>}
        {visible.map((model) => <button key={model.id} onClick={() => select(model.id)} className={`w-full text-left p-3 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 ${selectedModelId === model.id ? 'bg-blue-50 dark:bg-blue-950/40' : ''}`}>
          <strong className="block text-sm">{model.name}</strong><span className="block text-xs text-zinc-500 break-all">{model.id}{model.contextLength ? ` · ${Math.round(model.contextLength / 1000)}K context` : ''}</span>
          {model.description && <span className="block text-xs text-zinc-500 mt-1 line-clamp-2">{model.description}</span>}
        </button>)}
      </div>
    </div>
  </div>;
}
