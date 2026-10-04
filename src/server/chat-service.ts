import type { Request, Response } from 'express';
import { db } from './db.ts';
import { decryptCredential } from './encryption.ts';
import { classifyPrompt } from './task-classifier.ts';
import { resolveModelRoute } from './model-router.ts';
import { streamWithFallback, ChatProviderError } from './chat-fallback.ts';
import { validatePrompt } from './rate-limit.ts';
import { getAppUrl } from './openrouter-oauth.ts';
import { routeToolIntent } from './plugins/intent-router.ts';
import type { TaskCategory, AiMode } from '../types/index.ts';

interface MessageParam {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function handleChatStream(req: Request, res: Response) {
  const requestStarted = Date.now();
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // 1. Verify OpenRouter connection
  const conn = await db.getProviderConnection(user.id, 'openrouter');
  if (!conn || !conn.encrypted_credential) {
    return res.status(403).json({
      error: 'Connect OpenRouter to start chatting.',
      code: 'OPENROUTER_NOT_CONNECTED',
    });
  }

  // Decrypt user credential securely (never log this!)
  let userApiKey = '';
  try {
    userApiKey = decryptCredential(conn.encrypted_credential);
  } catch (err) {
    console.error('[Chat] Failed to decrypt user credential:', err);
    return res.status(500).json({
      error: 'Credential decryption error. Please reconnect OpenRouter.',
      code: 'DECRYPT_ERROR',
    });
  }

  // 2. Validate prompt
  const { prompt, chatId: incomingChatId, aiMode = 'auto', modelId } = req.body;
  const validation = validatePrompt(prompt);
  if (!validation.valid || !validation.cleanPrompt) {
    return res.status(400).json({ error: validation.error || 'Invalid prompt' });
  }
  const cleanPrompt = validation.cleanPrompt;
  if (modelId != null && (typeof modelId !== 'string' || !modelId.endsWith(':free'))) {
    return res.status(400).json({ error: 'Please select a free chat model.' });
  }

  // 3. Resolve Chat and History
  let chatId = incomingChatId;
  let chat = chatId ? await db.getChatById(chatId, user.id) : undefined;
  if (!chat) {
    // Generate intelligent title from prompt
    const shortTitle = cleanPrompt.length > 40 ? cleanPrompt.slice(0, 37) + '...' : cleanPrompt;
    chat = await db.createChat(user.id, shortTitle);
    chatId = chat.id;
  }

  // Save user's message to DB
  await db.createMessage(chatId, 'user', cleanPrompt);

  // 4. Task Classification
  const classification = classifyPrompt(cleanPrompt, aiMode as AiMode);

  // 5. Model Resolution
  const routeResolution = await resolveModelRoute(classification.category, userApiKey, modelId);

  // Setup SSE stream headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const sendEvent = (data: any) => {
    if (!res.writableEnded && !res.destroyed) {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  };

  // Notify client of classification and routing
  sendEvent({
    type: 'classification',
    category: classification.category,
    confidence: classification.confidence,
    reason: classification.reason,
  });

  sendEvent({
    type: 'routing',
    category: classification.category,
    displayName: routeResolution.displayName,
    modelId: routeResolution.selectedModel,
    chatId,
  });

  // 6. Developer Tool Intent & Plugin Telemetry
  let toolResolution;
  try {
    toolResolution = await routeToolIntent(cleanPrompt, user.id);
    if (toolResolution.hasIntent) {
      if (toolResolution.requiresConnection) {
        sendEvent({
          type: 'tool_requirement',
          unconnectedProviders: toolResolution.unconnectedProviders,
          message: toolResolution.summaryMessage,
        });
      }
      if (toolResolution.actionProposal) {
        sendEvent({
          type: 'action_proposal',
          proposal: toolResolution.actionProposal,
        });
      }
    }
  } catch (err: any) {
    console.warn('[Tool Router] Error evaluating intent:', err?.message || err);
  }

  // Prepare full conversation messages for OpenRouter
  const history = await db.getChatMessages(chatId);
  const contextMessages: MessageParam[] = history.map((m) => ({
    role: m.role,
    content: m.content,
  }));
  contextMessages.unshift({ role: 'system', content: 'You are hello, a helpful AI assistant. Answer the user directly. Do not claim to have completed actions in external services unless a tool result confirms completion. If a request needs an unavailable action, explain what you can and cannot do.' });

  // If live telemetry/inspection data was gathered, augment the prompt context
  if (toolResolution?.toolContextPrompt) {
    const lastUserMsg = contextMessages[contextMessages.length - 1];
    if (lastUserMsg && lastUserMsg.role === 'user') {
      lastUserMsg.content += toolResolution.toolContextPrompt;
    }
  }

  // Leave time for persistence and closing SSE before Vercel's 60-second limit.
  const controller = new AbortController();
  const onClose = () => { if (!res.writableEnded) controller.abort(new Error('Client disconnected')); };
  res.on('close', onClose);
  if (res.destroyed) controller.abort();
  const heartbeat = setInterval(() => { if (!res.destroyed && !res.writableEnded) res.write(': keepalive\n\n'); }, 10000);
  try {
    const result = await streamWithFallback({
      models: [routeResolution.selectedModel, ...routeResolution.fallbackModels],
      apiKey: userApiKey,
      appUrl: getAppUrl(req),
      messages: contextMessages,
      signal: controller.signal,
      budgetMs: Math.max(1, Math.min(45000, 52000 - (Date.now() - requestStarted))),
      onChunk: text => sendEvent({ type: 'chunk', text }),
      onSwitch: (previousModel, activeModel, resetContent) => sendEvent({
        type: 'fallback_switch', previousModel, activeModel, resetContent,
        category: classification.category,
      }),
    });
    if (controller.signal.aborted || res.destroyed) return;
    const savedMsg = await db.createMessage(chatId, 'assistant', result.text, classification.category, result.model);
    sendEvent({ type: 'done', chatId, messageId: savedMsg.id, category: classification.category, modelId: result.model });
  } catch (error) {
    if (!controller.signal.aborted && !res.destroyed) {
      sendEvent({ type: 'error', code: error instanceof ChatProviderError ? error.code : 'CHAT_FAILED',
        error: error instanceof ChatProviderError ? error.message : 'The reply could not be completed. Please try again.' });
    }
  } finally {
    clearInterval(heartbeat);
    res.off('close', onClose);
    controller.abort();
    if (!res.writableEnded) res.end();
  }
}
