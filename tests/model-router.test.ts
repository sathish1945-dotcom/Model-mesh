import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveModelRoute } from '../src/server/model-router.ts';

test('task routes select explicit available chat models, never the random free router', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ data: [
    'cohere/north-mini-code:free',
    'google/gemma-4-31b-it:free',
    'nvidia/nemotron-3-ultra-550b-a55b:free',
    'inclusionai/ling-3.0-flash-fin:free',
  ].map((id) => ({ id, pricing: { prompt: '0', completion: '0' } })) }), { status: 200 });
  try {
    const coding = await resolveModelRoute('coding');
    const reasoning = await resolveModelRoute('reasoning');
    const finance = await resolveModelRoute('finance');
    const chat = await resolveModelRoute('general');
    assert.equal(coding.selectedModel, 'cohere/north-mini-code:free');
    assert.equal(reasoning.selectedModel, 'nvidia/nemotron-3-ultra-550b-a55b:free');
    assert.equal(finance.selectedModel, 'inclusionai/ling-3.0-flash-fin:free');
    assert.equal(chat.selectedModel, 'google/gemma-4-31b-it:free');
    for (const route of [coding, reasoning, finance, chat]) {
      assert.ok([route.selectedModel, ...route.fallbackModels].every((id) => id.endsWith(':free') && id !== 'openrouter/free'));
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});
