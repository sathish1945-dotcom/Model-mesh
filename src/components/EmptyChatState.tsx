import React from 'react';
import { Code, Brain, TrendingUp, Compass, ArrowUpRight } from 'lucide-react';
import { ModelMeshLogo } from './ModelMeshLogo.tsx';

interface EmptyChatStateProps {
  onSelectPrompt: (text: string) => void;
  isConnected: boolean;
  onConnectOpenRouter: () => void;
}

const SUGGESTIONS = [
  { label: 'Write and debug code', icon: Code, prompt: 'Write a TypeScript debounce function with immediate execution support and unit test cases.' },
  { label: 'Think through a decision', icon: Brain, prompt: 'Compare SQLite with PostgreSQL for a high-concurrency microservice. Provide trade-offs.' },
  { label: 'Understand a finance term', icon: TrendingUp, prompt: 'Explain the difference between Enterprise Value and Equity Value. When is EV/EBITDA preferred?' },
  { label: 'Summarize an idea', icon: Compass, prompt: 'Summarize the core principles of effective asynchronous communication in remote engineering teams.' },
];

export const EmptyChatState: React.FC<EmptyChatStateProps> = ({
  onSelectPrompt,
  isConnected,
  onConnectOpenRouter,
}) => {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-4 pt-10 pb-8 text-center sm:pt-20">
      <ModelMeshLogo className="w-12 h-12 mb-5 shadow-lg rounded-2xl shadow-indigo-500/15" />
      <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">What can I help with?</h1>
      <p className="mt-2 max-w-md text-sm leading-6 text-zinc-500 dark:text-zinc-400">ModelMesh selects an available free model for your question.</p>
      {!isConnected && (
        <button type="button" onClick={onConnectOpenRouter} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-indigo-600 px-5 text-sm font-medium text-white hover:bg-indigo-700 shadow-md shadow-indigo-500/20 micro-3d-button focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500">
          Connect OpenRouter <ArrowUpRight className="w-4 h-4" />
        </button>
      )}
      {!isConnected && <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Use your own account. Free model limits depend on OpenRouter.</p>}
      <div className="mt-10 grid w-full grid-cols-2 gap-2.5 sm:gap-3.5 text-left">
        {SUGGESTIONS.map(({ label, icon: Icon, prompt }) => (
          <button key={label} type="button" onClick={() => onSelectPrompt(prompt)} className="flex min-h-16 items-center gap-3 rounded-2xl border border-zinc-200/80 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md px-3.5 py-3.5 text-left text-xs sm:text-sm font-medium text-zinc-700 shadow-xs micro-3d-card hover:border-indigo-300 dark:hover:border-indigo-500/40 focus-visible:outline-2 focus-visible:outline-indigo-500 dark:border-zinc-800/80 dark:text-zinc-200">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 shrink-0">
              <Icon className="h-4 w-4" />
            </div>
            <span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
