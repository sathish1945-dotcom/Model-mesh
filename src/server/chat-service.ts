import type { Request, Response } from 'express';
import { db } from './db.ts';
import { decryptCredential } from './encryption.ts';
import { classifyPrompt } from './task-classifier.ts';
import { resolveModelRoute } from './model-router.ts';
import { getFreeChatModels } from './model-registry.ts';
import { validatePrompt } from './rate-limit.ts';
import { getAppUrl } from './openrouter-oauth.ts';
import { routeToolIntent } from './plugins/intent-router.ts';
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
  const { prompt, chatId: incomingChatId, aiMode = 'auto', modelId } = req.body;
  const validation = validatePrompt(prompt);
  if (!validation.valid || !validation.cleanPrompt) {
    return res.status(400).json({ error: validation.error || 'Invalid prompt' });
  }
  const cleanPrompt = validation.cleanPrompt;
  if (modelId != null && (typeof modelId !== 'string' || !modelId.endsWith(':free') || !(await getFreeChatModels()).some((model) => model.id === modelId))) {
    return res.status(400).json({ error: 'Selected free chat model is unavailable. Choose another in Models.' });
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
  const routeResolution = modelId
    ? { category: classification.category, selectedModel: modelId as string, fallbackModels: [], displayName: 'Selected model' }
    : await resolveModelRoute(classification.category, userApiKey);

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
  contextMessages.unshift({ role: 'system', content: 'You are ModelMesh, a helpful AI assistant. Answer the user directly. Do not claim to have completed actions in external services unless a tool result confirms completion. If a request needs an unavailable action, explain what you can and cannot do.' });

  // If live telemetry/inspection data was gathered, augment the prompt context
  if (toolResolution?.toolContextPrompt) {
    const lastUserMsg = contextMessages[contextMessages.length - 1];
    if (lastUserMsg && lastUserMsg.role === 'user') {
      lastUserMsg.content += toolResolution.toolContextPrompt;
    }
  }

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
      // If previous model already emitted partial tokens before failing,
      // reset fullAssistantResponse so fallback starts cleanly from scratch.
      const hadPartial = fullAssistantResponse.length > 0;
      if (hadPartial) {
        fullAssistantResponse = '';
      }

      sendEvent({
        type: 'fallback_switch',
        previousModel: modelsToTry[i - 1],
        activeModel: currentModel,
        category: classification.category,
        resetContent: hadPartial,
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
        console.warn(`[Chat] Model ${currentModel} returned HTTP ${openRouterRes.status}:`, errorText.slice(0, 160));

        // 1. HTTP 401: Invalid / Expired credentials. Stop cascade immediately.
        if (openRouterRes.status === 401) {
          sendEvent({
            type: 'error',
            error: 'OpenRouter authorization failed. Please reconnect your OpenRouter account.',
          });
          res.end();
          return;
        }

        // 2. HTTP 402: Account-wide credit or quota required. Stop cascade immediately.
        if (openRouterRes.status === 402) {
          sendEvent({
            type: 'error',
            error: USER_QUOTA_ERROR_MESSAGE,
          });
          res.end();
          return;
        }

        // 3. HTTP 429: Rate limited
        if (openRouterRes.status === 429) {
          const retryAfterHeader = openRouterRes.headers.get('retry-after');
          // Provider capacity and account quotas share HTTP 429. Keep the
          // distinction visible so users are not told to buy credits for an
          // upstream outage.
          const isUpstreamLimit = /temporarily rate-limited upstream|provider returned error|provider_code/i.test(errorText);
          const isAccountQuota = !isUpstreamLimit && /daily limit|quota|credit|free.model.*limit/i.test(errorText);

          // If account-wide quota error, stop the fallback cascade immediately
          if (isAccountQuota) {
            sendEvent({
              type: 'error',
              error: USER_QUOTA_ERROR_MESSAGE,
            });
            res.end();
            return;
          }

          // If retry-after is provided or we can try a fallback model
          if (i < modelsToTry.length - 1) {
            const waitTime = retryAfterHeader ? Math.min(parseInt(retryAfterHeader, 10) * 1000, 2000) : 500;
            if (waitTime > 0 && !isNaN(waitTime)) {
              await new Promise((r) => setTimeout(r, waitTime));
            }
            continue;
          }

          const waitSecs = retryAfterHeader ? `${retryAfterHeader}s` : 'a few moments';
          sendEvent({
            type: 'error',
            error: isUpstreamLimit
              ? `Free model providers are temporarily busy. Please wait ${waitSecs} and try again.`
              : `OpenRouter request limit reached. Please wait ${waitSecs} before trying again.`,
          });
          res.end();
          return;
        }

        // 4. HTTP 404 / 503 / 502 / 500: Model discontinued, overloaded, or server error.
        // Try next fallback if attempts remaining.
        if (i < modelsToTry.length - 1) {
          continue;
        }

        // Exhausted attempts without successful response
        sendEvent({
          type: 'error',
          error: 'The free AI model service is momentarily unavailable. Please retry in a few moments.',
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
      let modelStreamedText = '';
      let streamError = false;

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
              if (parsed.error) {
                console.warn(`[Chat] OpenRouter stream error from ${currentModel}:`, parsed.error);
                streamError = true;
                continue;
              }

              const choice = parsed.choices?.[0];
              if (!choice) continue;

              // Extract text safely without ever combining delta and text
              let rawChunk = '';
              if (typeof choice.delta?.content === 'string') {
                rawChunk = choice.delta.content;
              } else if (Array.isArray(choice.delta?.content)) {
                rawChunk = choice.delta.content
                  .map((p: any) => (typeof p === 'string' ? p : p?.text || ''))
                  .join('');
              } else if (typeof choice.text === 'string' && !choice.delta) {
                rawChunk = choice.text;
              }

              if (!rawChunk) continue;

              // Check if rawChunk is an accumulated snapshot rather than incremental delta.
              // If it starts with modelStreamedText, provider sent cumulative content.
              let delta = rawChunk;
              if (modelStreamedText && rawChunk.startsWith(modelStreamedText)) {
                delta = rawChunk.slice(modelStreamedText.length);
              } else if (modelStreamedText && rawChunk === modelStreamedText) {
                delta = '';
              }

              if (delta) {
                modelStreamedText += delta;
                fullAssistantResponse += delta;
                sendEvent({
                  type: 'chunk',
                  text: delta,
                });
              }
            } catch {
              // Ignore non-json chunks or keep-alive pings
            }
          }
        }
      }

      // Guardrail-only output is not a useful assistant response. Retry with
      // another explicit chat model rather than saving it as the answer.
      const unusableResponse = /^\s*(?:user safety\s*:\s*safe\s*)?(?:response safety\s*:\s*safe)\s*$/i.test(modelStreamedText);
      if (streamError || unusableResponse || !modelStreamedText.trim()) {
        if (i < modelsToTry.length - 1) continue;
        break;
      }

      successfulModel = currentModel;
      streamCompletedSuccessfully = true;
      break; // Successfully streamed!
    } catch (err: any) {
      console.warn(`[Chat] Error with model ${currentModel}:`, err?.message || err);
      // If we haven't completed streaming and fallback models remain, allow next fallback
      if (i < modelsToTry.length - 1) {
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
