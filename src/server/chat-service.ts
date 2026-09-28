import type { Request, Response } from 'express';
import { db } from './db.ts';
import { decryptCredential } from './encryption.ts';
import { classifyPrompt } from './task-classifier.ts';
import { resolveModelRoute } from './model-router.ts';
import { validatePrompt } from './rate-limit.ts';
import { getAppUrl } from './openrouter-oauth.ts';
import type { TaskCategory, AiMode } from '../types/index.ts';

const USER_QUOTA_ERROR_MESSAGE =
  'Your OpenRouter free usage limit has been reached. You can continue when your OpenRouter allowance resets or manage your OpenRouter account.';

interface MessageParam {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function handleChatStream(req: Request, res: Response) {
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
  const { prompt, chatId: incomingChatId, aiMode = 'auto' } = req.body;
  const validation = validatePrompt(prompt);
  if (!validation.valid || !validation.cleanPrompt) {
    return res.status(400).json({ error: validation.error || 'Invalid prompt' });
  }
  const cleanPrompt = validation.cleanPrompt;

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
  const routeResolution = await resolveModelRoute(classification.category, userApiKey);

  // Setup SSE stream headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const sendEvent = (data: any) => {
    if (!res.writableEnded) {
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

  // Prepare full conversation messages for OpenRouter
  const history = await db.getChatMessages(chatId);
  const contextMessages: MessageParam[] = history.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // Models to attempt: [primaryModel, ...fallbackModels]
  const modelsToTry = [routeResolution.selectedModel, ...routeResolution.fallbackModels];
  const appUrl = getAppUrl(req);

  let fullAssistantResponse = '';
  let successfulModel = '';
  let streamCompletedSuccessfully = false;

  for (let i = 0; i < modelsToTry.length; i++) {
    const currentModel = modelsToTry[i];
    const isFallback = i > 0;

    if (isFallback) {
      sendEvent({
        type: 'fallback_switch',
        previousModel: modelsToTry[i - 1],
        activeModel: currentModel,
        category: classification.category,
      });
    }

    try {
      const openRouterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${userApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': appUrl,
          'X-Title': 'ModelMesh',
          'User-Agent': 'ModelMesh/1.0',
        },
        body: JSON.stringify({
          model: currentModel,
          messages: contextMessages,
          stream: true,
        }),
      });

      if (!openRouterRes.ok) {
        const errorText = await openRouterRes.text();
        console.warn(`[Chat] Model ${currentModel} returned ${openRouterRes.status}:`, errorText.slice(0, 150));

        // If rate limit or credits or unavailable, try next fallback model
        if (openRouterRes.status === 429 || openRouterRes.status === 402 || openRouterRes.status === 503 || openRouterRes.status === 404) {
          if (i < modelsToTry.length - 1) {
            continue; // Try next fallback model
          }
          // If all failed and status is 429 or 402:
          sendEvent({
            type: 'error',
            error: USER_QUOTA_ERROR_MESSAGE,
          });
          res.end();
          return;
        }

        // Other API error - try fallback if available
        if (i < modelsToTry.length - 1) {
          continue;
        }

        sendEvent({
          type: 'error',
          error: 'An issue occurred while processing your request. Please try again.',
        });
        res.end();
        return;
      }

      // Stream the response body
      const body = openRouterRes.body;
      if (!body) {
        if (i < modelsToTry.length - 1) continue;
        throw new Error('No stream body received');
      }

      const reader = body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue;

          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6).trim();
            if (dataStr === '[DONE]') {
              continue;
            }

            try {
              const parsed = JSON.parse(dataStr);
              const textChunk = parsed.choices?.[0]?.delta?.content || '';
              if (textChunk) {
                fullAssistantResponse += textChunk;
                sendEvent({
                  type: 'chunk',
                  text: textChunk,
                });
              }
            } catch {
              // Ignore non-json chunks or keep-alive pings
            }
          }
        }
      }

      successfulModel = currentModel;
      streamCompletedSuccessfully = true;
      break; // Successfully streamed!
    } catch (err: any) {
      console.warn(`[Chat] Error with model ${currentModel}:`, err?.message || err);
      // If we haven't streamed content yet, try next fallback
      if (!fullAssistantResponse && i < modelsToTry.length - 1) {
        continue;
      }
      break;
    }
  }

  if (streamCompletedSuccessfully && fullAssistantResponse) {
    // Persist assistant message in DB
    const savedMsg = await db.createMessage(
      chatId,
      'assistant',
      fullAssistantResponse,
      classification.category,
      successfulModel
    );

    sendEvent({
      type: 'done',
      chatId,
      messageId: savedMsg.id,
      category: classification.category,
      modelId: successfulModel,
    });
  } else if (!res.writableEnded) {
    sendEvent({
      type: 'error',
      error: 'Unable to get a response from free models at this moment. Please retry in a few seconds.',
    });
  }

  res.end();
}

