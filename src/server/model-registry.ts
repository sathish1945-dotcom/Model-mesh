import type { TaskCategory } from '../types/index.ts';

export interface CategoryModelConfig {
  category: TaskCategory;
  displayName: string;
  badgeLabel: string;
  description: string;
  primaryModel: string;
  secondaryModel: string;
}

export const OPENROUTER_FREE_ROUTER_FALLBACK = 'openrouter/auto:free';

/**
 * Server-side centralized model registry.
 * Easy to update as OpenRouter free model offerings evolve over time.
 * Note: Free Model Policy guarantees only models with ':free' or free router are allowed.
 */
export const MODEL_REGISTRY: Record<TaskCategory, CategoryModelConfig> = {
  coding: {
    category: 'coding',
    displayName: 'Coding AI',
    badgeLabel: 'Coding AI',
    description: 'Specialized in algorithms, code generation, debugging, and system implementation',
    primaryModel: 'qwen/qwen-2.5-coder-32b-instruct:free',
    secondaryModel: 'meta-llama/llama-3.3-70b-instruct:free',
  },
  reasoning: {
    category: 'reasoning',
    displayName: 'Reasoning AI',
    badgeLabel: 'Reasoning AI',
    description: 'Optimized for step-by-step logic, complex problem solving, and architecture',
    primaryModel: 'deepseek/deepseek-r1:free',
    secondaryModel: 'qwen/qwq-32b:free',
  },
  finance: {
    category: 'finance',
    displayName: 'Finance AI',
    badgeLabel: 'Finance AI',
    description: 'Focused on financial statement analysis, valuations, markets, and investment concepts',
    primaryModel: 'meta-llama/llama-3.3-70b-instruct:free',
    secondaryModel: 'mistralai/mistral-small-24b-instruct-2501:free',
  },
  general: {
    category: 'general',
    displayName: 'General AI',
    badgeLabel: 'General AI',
    description: 'Versatile general-purpose intelligence for all conversational and creative requests',
    primaryModel: 'google/gemini-2.0-flash-exp:free',
    secondaryModel: 'meta-llama/llama-3.3-70b-instruct:free',
  },
};

// Cache for verified available models from OpenRouter
let availableFreeModelsCache: Set<string> | null = null;
let lastCacheFetchTime = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Fetch and refresh the list of free models from OpenRouter API to verify model availability.
 */
export async function refreshAvailableModels(apiKey?: string): Promise<Set<string>> {
  const now = Date.now();
  if (availableFreeModelsCache && now - lastCacheFetchTime < CACHE_TTL_MS) {
    return availableFreeModelsCache;
  }

  try {
    const headers: Record<string, string> = {
      'User-Agent': 'ModelMesh/1.0',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers,
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      const data = (await res.json()) as { data?: Array<{ id: string; pricing?: { prompt?: string; completion?: string } }> };
      if (Array.isArray(data.data)) {
        const freeModels = new Set<string>();
        for (const m of data.data) {
          // Free models have ':free' or 0 pricing
          if (m.id.endsWith(':free') || (m.pricing?.prompt === '0' && m.pricing?.completion === '0')) {
            freeModels.add(m.id);
          }
        }
        if (freeModels.size > 0) {
          availableFreeModelsCache = freeModels;
          lastCacheFetchTime = now;
          return freeModels;
        }
      }
    }
  } catch (err) {
    console.warn('[ModelRegistry] Could not refresh models list from OpenRouter:', err);
  }

  // Fallback to static configured models if network lookup fails
  if (!availableFreeModelsCache) {
    availableFreeModelsCache = new Set([
      'qwen/qwen-2.5-coder-32b-instruct:free',
      'deepseek/deepseek-r1:free',
      'qwen/qwq-32b:free',
      'meta-llama/llama-3.3-70b-instruct:free',
      'mistralai/mistral-small-24b-instruct-2501:free',
      'google/gemini-2.0-flash-exp:free',
      'openrouter/auto:free',
    ]);
  }
  return availableFreeModelsCache;
}

/**
 * Validates that a model adheres strictly to the Free Model Policy
 */
export function isFreeModel(modelId: string): boolean {
  return modelId.endsWith(':free') || modelId === 'openrouter/auto:free';
}
