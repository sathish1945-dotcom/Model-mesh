import React from 'react';
import { Sparkles, Code, Brain, TrendingUp, Compass, ArrowRightLeft } from 'lucide-react';
import type { TaskCategory } from '../types/index.ts';
import { displayModelName } from '../lib/model-name.ts';

interface RoutingIndicatorProps {
  status: 'routing' | 'streaming' | 'idle';
  category?: TaskCategory;
  modelDisplayName?: string;
  isFallback?: boolean;
}

const CATEGORY_MAP: Record<TaskCategory, { label: string; icon: React.ReactNode; color: string }> = {
  coding: {
    label: 'Coding AI',
    icon: <Code className="w-3.5 h-3.5 text-emerald-500" />,
    color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800',
  },
  reasoning: {
    label: 'Reasoning AI',
    icon: <Brain className="w-3.5 h-3.5 text-purple-500" />,
    color: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800',
  },
  finance: {
    label: 'Finance AI',
    icon: <TrendingUp className="w-3.5 h-3.5 text-amber-500" />,
    color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800',
  },
  general: {
    label: 'General AI',
    icon: <Compass className="w-3.5 h-3.5 text-blue-500" />,
    color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800',
  },
};

export const RoutingIndicator: React.FC<RoutingIndicatorProps> = ({
  status,
  category,
  modelDisplayName,
  isFallback,
}) => {
  if (status === 'idle') return null;

  if (status === 'routing') {
    return (
      <div className="flex items-center justify-center py-2 px-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50 shadow-xs animate-pulse">
          <Sparkles className="w-3.5 h-3.5 animate-spin" />
          <span>Finding the best AI model...</span>
        </div>
      </div>
    );
  }

  if (category) {
    const meta = CATEGORY_MAP[category] || CATEGORY_MAP.general;
    return (
      <div className="flex items-center justify-center py-1.5 px-3">
        <div className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-medium border shadow-2xs ${meta.color}`}>
          {isFallback ? <ArrowRightLeft className="w-3 h-3 text-amber-500" /> : meta.icon}
          <span className="truncate max-w-[min(75vw,28rem)]" title={modelDisplayName}>{isFallback ? 'Fallback · ' : 'Running · '}{displayModelName(modelDisplayName) || meta.label}</span>
        </div>
      </div>
    );
  }

  return null;
};
