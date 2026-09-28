import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  Bot,
  User,
  Code,
  Brain,
  TrendingUp,
  Compass,
} from 'lucide-react';
import type { ChatMessage, TaskCategory } from '../types/index.ts';

interface ChatMessageItemProps {
  message: ChatMessage;
  isStreaming?: boolean;
  onRegenerate?: () => void;
  isLastAssistantMessage?: boolean;
}

const CATEGORY_META: Record<
  TaskCategory,
  { label: string; icon: React.ReactNode; colorClass: string }
> = {
  coding: {
    label: 'Coding AI',
    icon: <Code className="w-3 h-3 text-emerald-500" />,
    colorClass: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60',
  },
  reasoning: {
    label: 'Reasoning AI',
    icon: <Brain className="w-3 h-3 text-purple-500" />,
    colorClass: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800/60',
  },
  finance: {
    label: 'Finance AI',
    icon: <TrendingUp className="w-3 h-3 text-amber-500" />,
    colorClass: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/60',
  },
  general: {
    label: 'General AI',
    icon: <Compass className="w-3 h-3 text-blue-500" />,
    colorClass: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/60',
  },
};

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({
  message,
  isStreaming,
  onRegenerate,
  isLastAssistantMessage,
}) => {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const categoryMeta = message.model_category ? CATEGORY_META[message.model_category] : null;

  return (
    <div
      className={`py-4 px-3 sm:px-6 flex gap-3.5 transition-colors ${
        isUser
          ? 'bg-transparent'
          : 'bg-zinc-50/70 dark:bg-zinc-900/40 border-y border-zinc-100 dark:border-zinc-800/40'
      }`}
    >
      {/* Avatar */}
      <div className="shrink-0 mt-0.5">
        {isUser ? (
          <div className="w-7 h-7 rounded-full bg-zinc-800 dark:bg-zinc-700 text-white flex items-center justify-center text-xs shadow-xs">
            <User className="w-4 h-4" />
          </div>
        ) : (
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-xs shadow-xs">
            <Bot className="w-4 h-4" />
          </div>
        )}
      </div>

      {/* Content Body */}
      <div className="flex-1 min-w-0 space-y-2">
        {/* Header / Routing Badge for AI response */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              {isUser ? 'You' : 'ModelMesh'}
            </span>

            {/* Model Category Badge */}
            {!isUser && categoryMeta && (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${categoryMeta.colorClass}`}
                title={message.model_id ? `Model: ${message.model_id}` : undefined}
              >
                {categoryMeta.icon}
                <span>Using {categoryMeta.label}</span>
              </span>
            )}

            {/* Live Streaming Indicator */}
            {!isUser && isStreaming && (
              <span className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 animate-ping" />
                <span>Generating...</span>
              </span>
            )}
          </div>

          {/* Action buttons (Copy, Regenerate) */}
          <div className="flex items-center gap-1 opacity-80 hover:opacity-100 transition-opacity">
            <button
              onClick={handleCopyMessage}
              className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded hover:bg-zinc-200/50 dark:hover:bg-zinc-800 transition-colors"
              title="Copy message"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>

            {!isUser && onRegenerate && isLastAssistantMessage && !isStreaming && (
              <button
                onClick={onRegenerate}
                className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded hover:bg-zinc-200/50 dark:hover:bg-zinc-800 transition-colors"
                title="Regenerate response"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Message Text / Markdown */}
        <div className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200 break-words">
          {isUser ? (
            <div className="whitespace-pre-wrap">{message.content}</div>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-pre:my-3 prose-pre:p-0 prose-pre:bg-transparent">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ node, inline, className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || '');
                    const codeText = String(children).replace(/\n$/, '');

                    if (!inline && (match || codeText.includes('\n'))) {
                      return <CodeBlock language={match ? match[1] : ''} code={codeText} />;
                    }
                    return (
                      <code
                        className="px-1.5 py-0.5 rounded text-xs font-mono bg-zinc-100 dark:bg-zinc-800 text-pink-600 dark:text-pink-400 font-medium"
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  },
                  table({ children }: any) {
                    return (
                      <div className="overflow-x-auto my-3 border border-zinc-200 dark:border-zinc-800 rounded-lg">
                        <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800 text-xs">
                          {children}
                        </table>
                      </div>
                    );
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface CodeBlockProps {
  language: string;
  code: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-900 text-zinc-100">
      <div className="px-3.5 py-1.5 bg-zinc-950/80 border-b border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
        <span className="font-mono text-[11px] uppercase tracking-wider">{language || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 transition-colors text-[11px]"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3.5 text-xs font-mono overflow-x-auto leading-relaxed text-zinc-200">
        <code>{code}</code>
      </pre>
    </div>
  );
};
