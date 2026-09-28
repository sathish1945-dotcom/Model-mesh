import React from 'react';
import {
  Sparkles,
  Code,
  Brain,
  TrendingUp,
  Compass,
  ArrowRight,
  Key,
  ShieldCheck,
} from 'lucide-react';
import type { TaskCategory } from '../types/index.ts';

interface EmptyChatStateProps {
  onSelectPrompt: (text: string) => void;
  isConnected: boolean;
  onConnectOpenRouter: () => void;
}

const SAMPLE_PROMPTS = [
  {
    category: 'coding' as TaskCategory,
    title: 'Coding Task',
    label: 'Python / React / Debug',
    icon: <Code className="w-4 h-4 text-emerald-500" />,
    prompt: 'Write a TypeScript debounce function with immediate execution support and unit test cases.',
  },
  {
    category: 'reasoning' as TaskCategory,
    title: 'Complex Reasoning',
    label: 'Architecture & Logic',
    icon: <Brain className="w-4 h-4 text-purple-500" />,
    prompt: 'Compare SQLite with PostgreSQL for a high-concurrency microservice. Provide trade-offs.',
  },
  {
    category: 'finance' as TaskCategory,
    title: 'Finance Query',
    label: 'Valuation & Metrics',
    icon: <TrendingUp className="w-4 h-4 text-amber-500" />,
    prompt: 'Explain the difference between Enterprise Value and Equity Value. When is EV/EBITDA preferred?',
  },
  {
    category: 'general' as TaskCategory,
    title: 'General Query',
    label: 'Everyday Assistance',
    icon: <Compass className="w-4 h-4 text-blue-500" />,
    prompt: 'Summarize the core principles of effective asynchronous communication in remote engineering teams.',
  },
];

export const EmptyChatState: React.FC<EmptyChatStateProps> = ({
  onSelectPrompt,
  isConnected,
  onConnectOpenRouter,
}) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-2xl mx-auto my-auto animate-in fade-in duration-300">
      {/* Brand Icon */}
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 mb-4">
        <Sparkles className="w-6 h-6" />
      </div>

      <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mb-2">
        Intelligent Free AI Model Routing
      </h1>
      <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 max-w-md mb-6 leading-relaxed">
        Ask anything. ModelMesh analyzes your prompt and automatically routes it to the optimal free OpenRouter model — zero configuration required.
      </p>

      {/* OpenRouter Connection Callout if disconnected */}
      {!isConnected && (
        <div className="w-full mb-8 p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-left flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                Connect OpenRouter to start chatting
              </div>
              <div className="text-[11px] text-amber-700/80 dark:text-amber-400/80 leading-snug">
                One-click OAuth PKCE authorization. No manual API keys required. Exclusively uses free models.
              </div>
            </div>
          </div>
          <button
            onClick={onConnectOpenRouter}
            className="w-full sm:w-auto px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shrink-0 shadow-xs transition-colors flex items-center justify-center gap-1.5"
          >
            <span>Connect OpenRouter</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Suggested Prompts Grid */}
      <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
        {SAMPLE_PROMPTS.map((item, idx) => (
          <button
            key={idx}
            onClick={() => onSelectPrompt(item.prompt)}
            className="group p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 hover:border-blue-400/40 dark:hover:border-blue-500/40 text-left transition-all shadow-xs flex flex-col justify-between"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <div className="p-1 rounded-md bg-zinc-100 dark:bg-zinc-800">{item.icon}</div>
              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                {item.title}
              </span>
              <span className="text-[10px] text-zinc-400 font-medium ml-auto">
                {item.label}
              </span>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2 leading-relaxed">
              "{item.prompt}"
            </p>
          </button>
        ))}
      </div>
    </div>
  );
};
