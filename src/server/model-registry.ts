import type { TaskCategory } from '../types/index.ts';

export interface CategoryModelConfig {
  category: TaskCategory;
  displayName: string;
  badgeLabel: string;
  description: string;
  primaryModel: string;
  secondaryModel: string;
}

/**
 * Server-side centralized model registry.
 * Easy to update as OpenRouter free model offerings evolve over time.
 * Only explicit free models are used for chat; the free router selects randomly.
 */
export const MODEL_REGISTRY: Record<TaskCategory, CategoryModelConfig> = {
  coding: {
    category: 'coding',
    displayName: 'Coding AI',
    badgeLabel: 'Coding AI',
    description: 'Specialized in algorithms, code generation, debugging, and system implementation',
    primaryModel: 'cohere/north-mini-code:free',
    secondaryModel: 'qwen/qwen3.8-27b:free',
  },
  reasoning: {
    category: 'reasoning',
    displayName: 'Reasoning AI',
    badgeLabel: 'Reasoning AI',
    description: 'Optimized for step-by-step logic, complex problem solving, and architecture',
    primaryModel: 'nvidia/nemotron-3-ultra-550b-a55b:free',
    secondaryModel: 'google/gemma-4-31b-it:free',
  },
  finance: {
    category: 'finance',
    displayName: 'Finance AI',
    badgeLabel: 'Finance AI',
    description: 'Focused on financial statement analysis, valuations, markets, and investment concepts',
    primaryModel: 'inclusionai/ling-3.0-flash-fin:free',
    secondaryModel: 'google/gemma-4-31b-it:free',
  },
  general: {
    category: 'general',
    displayName: 'General AI',
    badgeLabel: 'General AI',
    description: 'Versatile general-purpose intelligence for all conversational and creative requests',
    primaryModel: 'google/gemma-4-31b-it:free',
    secondaryModel: 'inclusionai/ling-3.0-flash:free',
  },
};

// Cache for verified available models from OpenRouter
let availableFreeModelsCache: Set<string> | null = null;
let freeChatModelDetails: Array<{ id: string; name: string; description: string; contextLength?: number }> = [];
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
      'User-Agent': 'hello/1.0',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers,
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      const data = (await res.json()) as { data?: Array<{ id: string; name?: string; description?: string; context_length?: number; architecture?: { input_modalities?: string[]; output_modalities?: string[] }; pricing?: { prompt?: string; completion?: string } }> };
      if (Array.isArray(data.data)) {
        const freeModels = new Set<string>();
        freeChatModelDetails = [];
        for (const m of data.data) {
          // Free models have ':free' or 0 pricing
          const isChat = m.architecture?.input_modalities?.includes('text') !== false && m.architecture?.output_modalities?.includes('text') !== false;
          const isUtility = /\b(safety|moderation|guardrail|embedding|rerank)\b/i.test(`${m.id} ${m.name || ''}`);
          if (m.id.endsWith(':free') && isChat && !isUtility) {
            freeModels.add(m.id);
            freeChatModelDetails.push({ id: m.id, name: m.name || m.id, description: (m.description || '').slice(0, 220), contextLength: m.context_length });
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
      'google/gemma-4-26b-a4b-it:free',
      'google/gemma-4-31b-it:free',
      'qwen/qwen3.8-27b:free',
      'cohere/north-mini-code:free',
      'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
      'nvidia/nemotron-3-ultra-550b-a55b:free',
      'inclusionai/ling-3.0-flash-fin:free',
      'inclusionai/ling-3.0-flash:free',
      'liquid/lfm-2.5-2.6b:free',
    ]);
  }
  return availableFreeModelsCache;
}

/**
 * Validates that a model adheres strictly to the Free Model Policy
 */
export function isFreeModel(modelId: string): boolean {
  return modelId.endsWith(':free') || modelId === 'openrouter/free' || modelId === 'openrouter/auto:free';
}

export async function getFreeChatModels() {
  const available = await refreshAvailableModels();
  return freeChatModelDetails.length
    ? freeChatModelDetails.filter((model) => available.has(model.id)).sort((a, b) => a.name.localeCompare(b.name))
    : [...available].filter((id) => id.endsWith(':free')).map((id) => ({ id, name: id, description: '' }));
}
