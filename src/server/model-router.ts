import type { TaskCategory, RouteResolution } from '../types/index.ts';
import { MODEL_REGISTRY, isFreeModel, refreshAvailableModels } from './model-registry.ts';

export async function resolveModelRoute(
  category: TaskCategory,
  userApiKey?: string
): Promise<RouteResolution> {
  const config = MODEL_REGISTRY[category] || MODEL_REGISTRY.general;
  const availableModels = await refreshAvailableModels(userApiKey);

  // Explicit free models only. The free router randomly picks a provider and can
  // return a moderation model instead of an assistant, so never send chat to it.
  const preferences = [config.primaryModel, config.secondaryModel,
    MODEL_REGISTRY.general.primaryModel, MODEL_REGISTRY.general.secondaryModel,
    'qwen/qwen3.8-27b:free'];
  const candidates = [...new Set(preferences)].filter((model) => isFreeModel(model) && model !== 'openrouter/free');
  const verified = candidates.filter((model) => availableModels.has(model));
  // A failed catalog lookup must not silently turn into random routing.
  const cappedModels = (verified.length ? verified : candidates).slice(0, 3);

  const selectedModel = cappedModels[0];
  const fallbackModels = cappedModels.slice(1);

  return {
    category,
    selectedModel,
    fallbackModels,
    displayName: config.displayName,
  };
}
