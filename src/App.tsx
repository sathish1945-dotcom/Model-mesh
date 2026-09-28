import React, { useState, useEffect, useRef } from 'react';
import { Navbar } from './components/Navbar.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { ChatMessageItem } from './components/ChatMessageItem.tsx';
import { ChatInput } from './components/ChatInput.tsx';
import { EmptyChatState } from './components/EmptyChatState.tsx';
import { RoutingIndicator } from './components/RoutingIndicator.tsx';
import { ProviderSettingsModal } from './components/ProviderSettingsModal.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import { GoogleTasksModal } from './components/GoogleTasksModal.tsx';
import { initGoogleAuth } from './lib/firebase-auth.ts';
import { formatChatToMarkdown, downloadMarkdownFile } from './lib/export-markdown.ts';
import type {
  User,
  ProviderConnection,
  Chat,
  ChatMessage,
  AiMode,
  TaskCategory,
} from './types/index.ts';

export default function App() {
  // Theme state
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Auth & Provider state
  const [user, setUser] = useState<User | null>(null);
  const [providerStatus, setProviderStatus] = useState<ProviderConnection | null>(null);
  const [appUrl, setAppUrl] = useState<string>(window.location.origin);
  const [isConnectingOpenRouter, setIsConnectingOpenRouter] = useState(false);

  // Google Tasks Workspace OAuth state
  const [tasksToken, setTasksToken] = useState<string | null>(null);
  const [isTasksModalOpen, setIsTasksModalOpen] = useState(false);

  // Chat & History state
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [aiMode, setAiMode] = useState<AiMode>('auto');

  // UI & Drawer state
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [bannerAlert, setBannerAlert] = useState<{ message: string; type: 'error' | 'info' | 'success' } | null>(null);

  // Streaming & Routing indicator state
  const [isStreaming, setIsStreaming] = useState(false);
  const [routingStatus, setRoutingStatus] = useState<'idle' | 'routing' | 'streaming'>('idle');
  const [activeCategory, setActiveCategory] = useState<TaskCategory | undefined>();
  const [isFallbackRoute, setIsFallbackRoute] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync dark mode class
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Initial Load: check config, auth, and provider status
  useEffect(() => {
    fetchConfig();
    fetchCurrentUser();

    // Init Firebase Auth for Google Tasks
    const unsubscribe = initGoogleAuth(
      (_firebaseUser, token) => {
        setTasksToken(token);
      },
      () => {
        setTasksToken(null);
      }
    );

    return () => unsubscribe();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        if (data.appUrl) setAppUrl(data.appUrl);
      }
    } catch (e) {
      // Fallback to origin
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        if (data.user) {
          fetchProviderStatus();
          fetchChats();
        }
      }
    } catch (err) {
      console.error('Failed to fetch user:', err);
    }
  };

  const fetchProviderStatus = async () => {
    try {
      const res = await fetch('/api/openrouter/status');
      if (res.ok) {
        const data = await res.json();
        setProviderStatus({
          id: 'openrouter-status',
          user_id: user?.id || '',
          provider: 'openrouter',
          connection_status: data.connected ? 'connected' : 'disconnected',
          created_at: '',
          updated_at: data.updatedAt || '',
        });
      }
    } catch (err) {
      console.error('Failed to fetch provider status:', err);
    }
  };

  const fetchChats = async () => {
    try {
      const res = await fetch('/api/chats');
      if (res.ok) {
        const data = await res.json();
        setChats(data.chats || []);
      }
    } catch (err) {
      console.error('Failed to fetch chats:', err);
    }
  };

  const loadChatMessages = async (chatId: string) => {
    try {
      const res = await fetch(`/api/chats/${chatId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        setActiveChatId(chatId);
      }
    } catch (err) {
      console.error('Failed to load chat:', err);
    }
  };

  // Scroll to bottom on messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, routingStatus]);

  // Listen for OAuth PKCE postMessage from OpenRouter popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS' && event.data?.provider === 'openrouter') {
        fetchProviderStatus();
        setIsConnectingOpenRouter(false);
        setBannerAlert({
          message: 'OpenRouter connected successfully! Free models are ready.',
          type: 'success',
        });
        setTimeout(() => setBannerAlert(null), 4000);
      } else if (event.data?.type === 'OAUTH_AUTH_ERROR') {
        setIsConnectingOpenRouter(false);
        setBannerAlert({
          message: event.data?.error || 'Failed to connect OpenRouter. Please try again.',
          type: 'error',
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Initiate OpenRouter PKCE Connect Flow
  const handleConnectOpenRouter = async () => {
    if (!user) {
      setIsAuthOpen(true);
      return;
    }

    try {
      setIsConnectingOpenRouter(true);
      const res = await fetch('/api/openrouter/connect');
      if (!res.ok) {
        throw new Error('Could not initiate OpenRouter connection');
      }
      const data = await res.json();
      if (!data.url) {
        throw new Error('No authorization URL returned');
      }

      const popup = window.open(
        data.url,
        'openrouter_oauth_popup',
        'width=600,height=750,menubar=no,toolbar=no,location=no,status=no'
      );

      if (!popup) {
        alert('Please allow popups to connect your OpenRouter account.');
        setIsConnectingOpenRouter(false);
      }
    } catch (err: any) {
      console.error('OpenRouter connect error:', err);
      setBannerAlert({
        message: err.message || 'Failed to open OpenRouter authorization window',
        type: 'error',
      });
      setIsConnectingOpenRouter(false);
    }
  };

  const handleDisconnectOpenRouter = async () => {
    try {
      const res = await fetch('/api/openrouter/disconnect', { method: 'POST' });
      if (res.ok) {
        fetchProviderStatus();
        setBannerAlert({
          message: 'OpenRouter account disconnected.',
          type: 'info',
        });
        setTimeout(() => setBannerAlert(null), 3000);
      }
    } catch (err) {
      console.error('Failed to disconnect:', err);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      setProviderStatus(null);
      setChats([]);
      setActiveChatId(null);
      setMessages([]);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const handleNewChat = () => {
    if (isStreaming) {
      handleStopStreaming();
    }
    setActiveChatId(null);
    setMessages([]);
    setInput('');
    setRoutingStatus('idle');
    setActiveCategory(undefined);
    setIsFallbackRoute(false);
  };

  const handleDeleteChat = async (chatId: string) => {
    try {
      const res = await fetch(`/api/chats/${chatId}`, { method: 'DELETE' });
      if (res.ok) {
        setChats((prev) => prev.filter((c) => c.id !== chatId));
        if (activeChatId === chatId) {
          handleNewChat();
        }
      }
    } catch (err) {
      console.error('Failed to delete chat:', err);
    }
  };

  const handleExportCurrentChat = () => {
    if (messages.length === 0) return;
    const currentChat = chats.find((c) => c.id === activeChatId);
    const title = currentChat?.title || messages[0]?.content?.slice(0, 30) || 'ModelMesh Chat';
    const markdown = formatChatToMarkdown(title, messages);
    const sanitizedFilename = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'modelmesh-chat';

    downloadMarkdownFile(markdown, `${sanitizedFilename}.md`);
    setBannerAlert({
      message: `Chat conversation exported as ${sanitizedFilename}.md`,
      type: 'success',
    });
    setTimeout(() => setBannerAlert(null), 3000);
  };

  const handleExportSpecificChat = async (chatId: string) => {
    try {
      let targetMessages = messages;
      let targetTitle = chats.find((c) => c.id === chatId)?.title || 'ModelMesh Chat';

      if (chatId !== activeChatId) {
        const res = await fetch(`/api/chats/${chatId}`);
        if (!res.ok) throw new Error('Could not load chat messages for export');
        const data = await res.json();
        targetMessages = data.messages || [];
      }

      if (targetMessages.length === 0) {
        setBannerAlert({
          message: 'This conversation has no messages to export.',
          type: 'info',
        });
        setTimeout(() => setBannerAlert(null), 3000);
        return;
      }

      const markdown = formatChatToMarkdown(targetTitle, targetMessages);
      const sanitizedFilename = targetTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'modelmesh-chat';

      downloadMarkdownFile(markdown, `${sanitizedFilename}.md`);
      setBannerAlert({
        message: `Chat exported as ${sanitizedFilename}.md`,
        type: 'success',
      });
      setTimeout(() => setBannerAlert(null), 3000);
    } catch (err) {
      console.error('Export error:', err);
      setBannerAlert({
        message: 'Failed to export chat conversation',
        type: 'error',
      });
      setTimeout(() => setBannerAlert(null), 3000);
    }
  };

  const handleStopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setRoutingStatus('idle');
  };

  // Main Prompt Submission & SSE Streaming
  const handleSendMessage = async (customPrompt?: string) => {
    const promptToSend = customPrompt || input;
    if (!promptToSend.trim() || isStreaming) return;

    if (!user) {
      setIsAuthOpen(true);
      return;
    }

    if (providerStatus?.connection_status !== 'connected') {
      setBannerAlert({
        message: 'Connect OpenRouter to start chatting.',
        type: 'error',
      });
      setIsSettingsOpen(true);
      return;
    }

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      chat_id: activeChatId || 'temp',
      role: 'user',
      content: promptToSend.trim(),
      created_at: new Date().toISOString(),
    };

    const assistantMsgPlaceholder: ChatMessage = {
      id: `assistant-${Date.now()}`,
      chat_id: activeChatId || 'temp',
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg, assistantMsgPlaceholder]);
    setInput('');
    setIsStreaming(true);
    setRoutingStatus('routing');
    setActiveCategory(undefined);
    setIsFallbackRoute(false);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptToSend.trim(),
          chatId: activeChatId,
          aiMode,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData.code === 'OPENROUTER_NOT_CONNECTED') {
          setBannerAlert({
            message: 'Connect OpenRouter to start chatting.',
            type: 'error',
          });
          setIsSettingsOpen(true);
        } else {
          setBannerAlert({
            message: errorData.error || 'Failed to send prompt',
            type: 'error',
          });
        }
        setMessages((prev) => prev.slice(0, -1));
        setIsStreaming(false);
        setRoutingStatus('idle');
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No readable stream from server');

      const decoder = new TextDecoder('utf-8');
      let streamBuffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        streamBuffer += decoder.decode(value, { stream: true });
        const lines = streamBuffer.split('\n');
        streamBuffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const jsonStr = trimmed.slice(6).trim();

          try {
            const event = JSON.parse(jsonStr);

            if (event.type === 'classification') {
              setActiveCategory(event.category);
            } else if (event.type === 'routing') {
              setRoutingStatus('streaming');
              setActiveCategory(event.category);
              if (event.chatId && !activeChatId) {
                setActiveChatId(event.chatId);
                fetchChats();
              }
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last && last.role === 'assistant') {
                  last.model_category = event.category;
                  last.model_id = event.modelId;
                }
                return next;
              });
            } else if (event.type === 'fallback_switch') {
              setIsFallbackRoute(true);
              setBannerAlert({
                message: `Primary model unavailable. Switched seamlessly to free fallback model.`,
                type: 'info',
              });
              setTimeout(() => setBannerAlert(null), 3000);
            } else if (event.type === 'chunk') {
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last && last.role === 'assistant') {
                  last.content += event.text;
                }
                return next;
              });
            } else if (event.type === 'done') {
              setIsStreaming(false);
              setRoutingStatus('idle');
              if (event.chatId) {
                setActiveChatId(event.chatId);
                fetchChats();
              }
            } else if (event.type === 'error') {
              setBannerAlert({
                message: event.error,
                type: 'error',
              });
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last && last.role === 'assistant') {
                  last.content = last.content || `⚠️ ${event.error}`;
                }
                return next;
              });
              setIsStreaming(false);
              setRoutingStatus('idle');
            }
          } catch {
            // Ignore non-json chunk lines
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Chat stream error:', err);
        setBannerAlert({
          message: 'Network issue or connection interrupted. Please try again.',
          type: 'error',
        });
      }
    } finally {
      setIsStreaming(false);
      setRoutingStatus('idle');
      abortControllerRef.current = null;
    }
  };

  const handleRegenerate = () => {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUserMessage) {
      handleSendMessage(lastUserMessage.content);
    }
  };

  const isConnected = providerStatus?.connection_status === 'connected';

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans transition-colors">
      {/* Sidebar (History & Drawer) */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        chats={chats}
        activeChatId={activeChatId}
        onSelectChat={loadChatMessages}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
        onExportChat={handleExportSpecificChat}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        {/* Top Navbar */}
        <Navbar
          user={user}
          providerStatus={providerStatus}
          aiMode={aiMode}
          onSelectAiMode={setAiMode}
          onNewChat={handleNewChat}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenTasks={() => setIsTasksModalOpen(true)}
          isTasksConnected={Boolean(tasksToken)}
          onExportMarkdown={handleExportCurrentChat}
          hasMessagesToExport={messages.length > 0}
          onOpenAuth={() => setIsAuthOpen(true)}
          onLogout={handleLogout}
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode(!darkMode)}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          isSidebarOpen={isSidebarOpen}
        />

        {/* Global Banner Notification */}
        {bannerAlert && (
          <div
            className={`py-2 px-4 text-xs font-medium text-center transition-all flex items-center justify-center gap-2 ${
              bannerAlert.type === 'error'
                ? 'bg-red-500/10 text-red-700 dark:text-red-400 border-b border-red-500/20'
                : bannerAlert.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-b border-emerald-500/20'
                : 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-b border-blue-500/20'
            }`}
          >
            <span>{bannerAlert.message}</span>
            <button
              onClick={() => setBannerAlert(null)}
              className="ml-2 text-current opacity-70 hover:opacity-100 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Chat Scroll Area */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <EmptyChatState
              onSelectPrompt={(text) => {
                setInput(text);
                handleSendMessage(text);
              }}
              isConnected={isConnected}
              onConnectOpenRouter={handleConnectOpenRouter}
            />
          ) : (
            <div className="max-w-3xl mx-auto py-4 space-y-1">
              {messages.map((msg, index) => {
                const isLastAssistant =
                  msg.role === 'assistant' && index === messages.length - 1;
                return (
                  <ChatMessageItem
                    key={msg.id || index}
                    message={msg}
                    isStreaming={isStreaming && isLastAssistant}
                    onRegenerate={handleRegenerate}
                    isLastAssistantMessage={isLastAssistant}
                  />
                );
              })}

              {/* Dynamic Routing / Model Indicator during generation */}
              <RoutingIndicator
                status={routingStatus}
                category={activeCategory}
                isFallback={isFallbackRoute}
              />

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Bottom Input Area */}
        <ChatInput
          input={input}
          setInput={setInput}
          onSend={() => handleSendMessage()}
          onStop={handleStopStreaming}
          onNewChat={handleNewChat}
          isStreaming={isStreaming}
          disabled={!isConnected && !user}
          aiMode={aiMode}
        />
      </div>

      {/* Provider Settings Modal */}
      <ProviderSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        providerStatus={providerStatus}
        onConnectOpenRouter={handleConnectOpenRouter}
        onDisconnectOpenRouter={handleDisconnectOpenRouter}
        appUrl={appUrl}
        isConnecting={isConnectingOpenRouter}
      />

      {/* Google Tasks Workspace Modal */}
      <GoogleTasksModal
        isOpen={isTasksModalOpen}
        onClose={() => setIsTasksModalOpen(false)}
        tasksToken={tasksToken}
        onTokenChange={setTasksToken}
        onSendToChat={(prompt) => {
          setInput(prompt);
          handleSendMessage(prompt);
        }}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthSuccess={(u) => {
          setUser(u);
          fetchProviderStatus();
          fetchChats();
        }}
      />
    </div>
  );
}
