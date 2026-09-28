import type { TaskCategory, RouteResolution } from '../types/index.ts';
import { MODEL_REGISTRY, OPENROUTER_FREE_ROUTER_FALLBACK, refreshAvailableModels } from './model-registry.ts';

export async function resolveModelRoute(
  category: TaskCategory,
  userApiKey?: string
): Promise<RouteResolution> {
  const config = MODEL_REGISTRY[category] || MODEL_REGISTRY.general;
  const availableModels = await refreshAvailableModels(userApiKey);

  // Free model hierarchy: Primary -> Secondary -> OpenRouter Free Router
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
    candidateModels.push(config.primaryModel, config.secondaryModel);
  }

  // Always include the OpenRouter free router as final safety net
  if (!candidateModels.includes(OPENROUTER_FREE_ROUTER_FALLBACK)) {
    candidateModels.push(OPENROUTER_FREE_ROUTER_FALLBACK);
  }

  const selectedModel = candidateModels[0];
  const fallbackModels = candidateModels.slice(1);

  return {
    category,
    selectedModel,
    fallbackModels,
    displayName: config.displayName,
  };
}
