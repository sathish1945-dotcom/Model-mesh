import React, { useRef, useEffect } from 'react';
import { Send, Square, Plus, Sparkles } from 'lucide-react';
import type { AiMode } from '../types/index.ts';

interface ChatInputProps {
  input: string;
  setInput: (val: string) => void;
  onSend: () => void;
  onStop: () => void;
  onNewChat: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  aiMode: AiMode;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  input,
  setInput,
  onSend,
  onStop,
  onNewChat,
  isStreaming,
  disabled,
  aiMode,
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
    if (e.key === 'Enter' && !e.shiftKey) {
      if (e.nativeEvent.isComposing) return;
      e.preventDefault();
      if (!isStreaming && input.trim() && !disabled) {
        onSend();
      }
    }
  };

  return (
    <div className="p-3 sm:p-4 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800 transition-colors">
      <div className="max-w-3xl mx-auto space-y-2">
        <div className="relative flex items-end gap-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus-within:border-blue-500 dark:focus-within:border-blue-500 rounded-2xl p-2 shadow-sm transition-colors">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={
              disabled
                ? 'Please connect OpenRouter to start chatting...'
                : aiMode === 'auto'
                ? 'Ask anything... (automatically routed to free model)'
                : `Ask a ${aiMode} question...`
            }
            className="flex-1 bg-transparent border-0 outline-hidden resize-none text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 max-h-44 px-2 py-1.5 leading-relaxed"
          />

          <div className="flex items-center gap-1.5 shrink-0 mb-0.5">
            {/* New chat icon button */}
            <button
              type="button"
              onClick={onNewChat}
              className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-800 rounded-xl transition-colors"
              title="Start a new chat"
            >
              <Plus className="w-4 h-4" />
            </button>

            {/* Send or Stop Button */}
            {isStreaming ? (
              <button
                type="button"
                onClick={onStop}
                className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-xs transition-transform active:scale-95"
                title="Stop generation"
              >
                <Square className="w-4 h-4 fill-white" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onSend}
                disabled={!input.trim() || disabled || isStreaming}
                className="p-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 text-white rounded-xl shadow-xs transition-transform active:scale-95"
                title="Send message (Enter)"
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-zinc-400 dark:text-zinc-500 px-1">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-blue-500" />
            <span>Mode: <strong className="capitalize text-zinc-600 dark:text-zinc-400">{aiMode}</strong></span>
            <span>• Only free models used</span>
          </div>
          <div>Press Enter to send, Shift+Enter for new line</div>
        </div>
      </div>
    </div>
  );
};
