import type { ChatMessage } from '../types/index.ts';

/**
 * Converts a chat conversation into a formatted Markdown string.
 */
export function formatChatToMarkdown(
  title: string,
  messages: ChatMessage[],
  exportDate: Date = new Date()
): string {
  const formattedDate = exportDate.toLocaleString();
  let markdown = `# ${title || 'Chat Conversation'}\n\n`;
  markdown += `*Exported from hello on ${formattedDate}*\n\n`;
  markdown += `---\n\n`;

  messages.forEach((msg, index) => {
    const isUser = msg.role === 'user';
    const sender = isUser ? '👤 User' : '🤖 Assistant';
    const timestamp = msg.created_at ? new Date(msg.created_at).toLocaleTimeString() : '';
    const metadata = [timestamp, msg.model_id ? `Model: \`${msg.model_id}\`` : '', msg.model_category ? `Category: ${msg.model_category}` : '']
      .filter(Boolean)
      .join(' • ');

    markdown += `### ${sender}${metadata ? ` *(${metadata})*` : ''}\n\n`;
    markdown += `${msg.content || '*(No content)*'}\n\n`;

    if (index < messages.length - 1) {
      markdown += `---\n\n`;
    }
  });

  return markdown;
}

/**
 * Triggers a client-side download of a markdown text file.
 */
export function downloadMarkdownFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename.endsWith('.md') ? filename : `${filename}.md`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
