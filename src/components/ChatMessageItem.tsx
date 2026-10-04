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
  Blocks,
} from 'lucide-react';
import type { ChatMessage } from '../types/index.ts';
import { ActionProposalCard } from './ActionProposalCard.tsx';

interface ChatMessageItemProps {
  message: ChatMessage;
  isStreaming?: boolean;
  onRegenerate?: () => void;
  isLastAssistantMessage?: boolean;
  onOpenIntegrations?: () => void;
}

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({
  message,
  isStreaming,
  onRegenerate,
  isLastAssistantMessage,
  onOpenIntegrations,
}) => {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };


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
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              {isUser ? 'You' : 'hello👋'}
            </span>

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

              {/* Tool Requirement Callout */}
              {message.toolRequirement && (
                <div className="my-3 p-3 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/40 flex items-center justify-between gap-3 text-xs not-prose">
                  <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                    <Blocks className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
                    <span>{message.toolRequirement.message}</span>
                  </div>
                  {onOpenIntegrations && (
                    <button
                      onClick={onOpenIntegrations}
                      className="shrink-0 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium shadow-2xs"
                    >
                      Connect Tools
                    </button>
                  )}
                </div>
              )}

              {/* Action Proposal Card */}
              {message.proposal && (
                <div className="not-prose">
                  <ActionProposalCard proposal={message.proposal} />
                </div>
              )}
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
