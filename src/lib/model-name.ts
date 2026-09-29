const DISPLAY_NAMES: Record<string, string> = {
  'cohere/north-mini-code:free': 'North Mini Code',
  'qwen/qwen3.8-27b:free': 'Qwen 3.8 27B',
  'nvidia/nemotron-3-ultra-550b-a55b:free': 'Nemotron 3 Ultra',
  'google/gemma-4-31b-it:free': 'Gemma 4 31B',
  'google/gemma-4-26b-a4b-it:free': 'Gemma 4 26B',
  'inclusionai/ling-3.0-flash-fin:free': 'Ling 3.0 Finance',
};

export function displayModelName(modelId?: string): string | undefined {
  if (!modelId) return undefined;
  return DISPLAY_NAMES[modelId] || modelId.replace(/:free$/, '').split('/').pop()?.replace(/[-_]/g, ' ');
}
