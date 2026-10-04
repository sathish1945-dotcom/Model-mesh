import React, { useRef, useEffect } from 'react';
import { Send, Square, Plus, Sparkles } from 'lucide-react';

interface ChatInputProps {
  input: string;
  setInput: (val: string) => void;
  onSend: () => void;
  onStop: () => void;
  onNewChat: () => void;
  isStreaming: boolean;
  disabled?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  input,
  setInput,
  onSend,
  onStop,
  onNewChat,
  isStreaming,
  disabled,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !window.matchMedia('(pointer: coarse)').matches) {
      if (e.nativeEvent.isComposing) return;
      e.preventDefault();
      if (!isStreaming && input.trim() && !disabled) {
        onSend();
      }
    }
  };

  return (
    <div className="hello-composer px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800 transition-colors">
      <div className="max-w-3xl mx-auto space-y-2">
        <div className="hello-composer-box relative flex items-end gap-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus-within:border-blue-500 dark:focus-within:border-blue-500 rounded-2xl p-2 shadow-sm transition-colors">
          <textarea
            ref={textareaRef}
            aria-label="Message hello"
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder="Message hello…"
            className="flex-1 min-w-0 bg-transparent border-0 outline-hidden resize-none text-base sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 max-h-44 px-2 py-1.5 leading-relaxed"
          />

          <div className="flex items-center gap-1.5 shrink-0 mb-0.5">
            {/* New chat icon button */}
            <button
              type="button"
              onClick={onNewChat}
              className="hidden sm:flex min-w-10 min-h-10 items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-800 rounded-xl transition-colors"
              aria-label="New chat" title="Start a new chat"
            >
              <Plus className="w-4 h-4" />
            </button>

            {/* Send or Stop Button */}
            {isStreaming ? (
              <button
                type="button"
                onClick={onStop}
                className="min-w-11 min-h-11 flex items-center justify-center bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-xs transition-transform active:scale-95"
                aria-label="Stop generation" title="Stop generation"
              >
                <Square className="w-4 h-4 fill-white" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onSend}
                disabled={!input.trim() || disabled || isStreaming}
                className="min-w-11 min-h-11 flex items-center justify-center bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 text-white rounded-xl shadow-xs transition-transform active:scale-95"
                aria-label="Send message" title="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-zinc-400 dark:text-zinc-500 px-1">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-blue-500" />
            <span>hello can make mistakes. Check important information.</span>
          </div>
          <div className="hidden sm:block">Enter to send · Shift+Enter for a new line</div>
        </div>
      </div>
    </div>
  );
};
