import type { TaskCategory, RouteResolution } from '../types/index.ts';
import { MODEL_REGISTRY, OPENROUTER_FREE_ROUTER_FALLBACK, refreshAvailableModels } from './model-registry.ts';

export async function resolveModelRoute(
  category: TaskCategory,
  userApiKey?: string
): Promise<RouteResolution> {
  const config = MODEL_REGISTRY[category] || MODEL_REGISTRY.general;
  const availableModels = await refreshAvailableModels(userApiKey);

  // Free model hierarchy: Primary -> Secondary -> OpenRouter Free Router (Max 3 total attempts)
  const candidateModels: string[] = [];

  // Check if primary model is available
  if (availableModels.has(config.primaryModel)) {
    candidateModels.push(config.primaryModel);
  }

  // Check if secondary model is available
  if (availableModels.has(config.secondaryModel)) {
    candidateModels.push(config.secondaryModel);
  }

  // If none from dynamic list matched, still include config.primaryModel as the first attempt
  if (candidateModels.length === 0) {
    candidateModels.push(config.primaryModel);
  }

  // Safety net: Always include the OpenRouter Free Router as maintained fallback
  if (!candidateModels.includes(OPENROUTER_FREE_ROUTER_FALLBACK)) {
    candidateModels.push(OPENROUTER_FREE_ROUTER_FALLBACK);
  }

  // Cap candidate models to maximum 3 attempts per user request
  const cappedModels = candidateModels.slice(0, 3);

  const selectedModel = cappedModels[0];
  const fallbackModels = cappedModels.slice(1);

  return {
    category,
    selectedModel,
    fallbackModels,
    displayName: config.displayName,
  };
}
