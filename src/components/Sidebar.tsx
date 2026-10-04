import React, { useState } from 'react';
import { Plus, MessageSquare, Trash2, X, Download, Blocks, Settings, LogOut, Sun, Moon, UserRound, Layers3 } from 'lucide-react';
import { ModelMeshLogo } from './ModelMeshLogo.tsx';
import type { Chat, User } from '../types/index.ts';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  chats: Chat[];
  activeChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
  onDeleteChat: (chatId: string) => void;
  onExportChat?: (chatId: string) => void;
  onOpenSettings: () => void;
  onOpenModels: () => void;
  onOpenIntegrations: () => void;
  onOpenAuth: () => void;
  onLogout: () => void;
  onToggleDarkMode: () => void;
  darkMode: boolean;
  user: User | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  chats,
  activeChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  onExportChat,
  onOpenSettings,
  onOpenModels,
  onOpenIntegrations,
  onOpenAuth,
  onLogout,
  onToggleDarkMode,
  darkMode,
  user,
}) => {
  const [search, setSearch] = useState('');
  const filteredChats = chats.filter(chat => (chat.title || '').toLowerCase().includes(search.toLowerCase()));
  const menuAction = (callback: () => void) => () => { callback(); if (window.innerWidth < 768) onClose(); };
  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-xs transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Sidebar container */}
      <aside
        inert={!isOpen}
        aria-hidden={!isOpen}
        className={`fixed md:static inset-y-0 left-0 z-50 w-[min(85vw,20rem)] md:w-72 bg-zinc-50 dark:bg-zinc-900/90 border-r border-zinc-200 dark:border-zinc-800 flex flex-col transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0 md:w-72'
        } ${!isOpen ? 'md:hidden' : ''}`}
      >
        {/* Top header */}
        <div className="p-3 border-b border-zinc-200/80 dark:border-zinc-800 flex items-center gap-2">
          <ModelMeshLogo className="w-7 h-7 shrink-0" />
          <span className="font-semibold text-sm flex-1">hello👋</span>
          <button onClick={onClose} aria-label="Close menu" className="md:hidden min-w-11 min-h-11 flex items-center justify-center rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-3 flex items-center justify-between">
          <button
            onClick={() => {
              onNewChat();
              if (window.innerWidth < 768) onClose();
            }}
            className="flex-1 flex items-center gap-3 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium text-sm min-h-11 px-3 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4 text-blue-500" />
            <span>New chat</span>
          </button>
        </div>

        <div className="px-3"><input aria-label="Search conversations" placeholder="Search conversations…" value={search} onChange={e => setSearch(e.target.value)} className="w-full min-h-11 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 text-sm" /></div>
        {/* Chat History List */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
          <div className="px-2 pb-1.5 text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
            Chat History
          </div>

          {filteredChats.length === 0 ? (
            <div className="text-center py-8 px-4 text-zinc-400 dark:text-zinc-500 text-xs">
              {search ? 'No matching conversations.' : 'No conversations yet. Start a new chat.'}
            </div>
          ) : (
            filteredChats.map((chat) => {
              const isActive = chat.id === activeChatId;
              return (
                <div
                  key={chat.id}
                  className={`group relative flex items-center justify-between pl-1 pr-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
                  }`}
                >
                  <button type="button" onClick={() => {
                    onSelectChat(chat.id);
                    if (window.innerWidth < 768) onClose();
                  }} className="flex flex-1 min-w-0 min-h-10 items-center gap-2.5 truncate px-2 text-left" aria-current={isActive ? 'page' : undefined}>
                    <MessageSquare
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isActive ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-400'
                      }`}
                    />
                    <span className="truncate">{chat.title || 'Untitled Chat'}</span>
                  </button>

                  {/* Actions: Export & Delete */}
                  <div className="flex items-center gap-1 shrink-0">
                    {onExportChat && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onExportChat(chat.id);
                        }}
                    className="opacity-100 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-700 rounded transition-all"
                        title="Export as Markdown (.md)"
                        aria-label="Export chat as Markdown"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteChat(chat.id);
                      }}
                      className="opacity-100 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition-all"
                      title="Delete conversation"
                      aria-label="Delete conversation"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="p-2 border-t border-zinc-200/80 dark:border-zinc-800 space-y-0.5 text-sm">
          <button onClick={menuAction(onOpenModels)} className="mobile-menu-item"><Layers3 className="w-4 h-4" /> Models & usage</button>
          <button onClick={menuAction(onOpenIntegrations)} className="mobile-menu-item"><Blocks className="w-4 h-4" /> Integrations</button>
          <button onClick={menuAction(onOpenSettings)} className="mobile-menu-item"><Settings className="w-4 h-4" /> OpenRouter settings</button>
          <button onClick={menuAction(onToggleDarkMode)} className="mobile-menu-item">{darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />} {darkMode ? 'Light theme' : 'Dark theme'}</button>
          {user ? <button onClick={menuAction(onLogout)} className="mobile-menu-item"><LogOut className="w-4 h-4" /> Sign out</button> : <button onClick={menuAction(onOpenAuth)} className="mobile-menu-item"><UserRound className="w-4 h-4" /> Sign in</button>}
        </div>
      </aside>
    </>
  );
};
