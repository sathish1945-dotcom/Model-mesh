import React from 'react';
import {
  Sparkles,
  Plus,
  Settings,
  LogOut,
  Moon,
  Sun,
  Menu,
  ChevronDown,
  Code,
  Brain,
  TrendingUp,
  Compass,
  Download,
  Blocks,
  Ellipsis,
} from 'lucide-react';
import { ModelMeshLogo } from './ModelMeshLogo.tsx';
import type { User, ProviderConnection, AiMode } from '../types/index.ts';

interface NavbarProps {
  user: User | null;
  providerStatus: ProviderConnection | null;
  aiMode: AiMode;
  onSelectAiMode: (mode: AiMode) => void;
  onNewChat: () => void;
  onOpenSettings: () => void;
  onOpenIntegrations: () => void;
  onExportMarkdown?: () => void;
  hasMessagesToExport?: boolean;
  onOpenAuth: () => void;
  onLogout: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
}

const MODE_OPTIONS: { id: AiMode; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'auto', label: 'Auto (Recommended)', icon: <Sparkles className="w-3.5 h-3.5 text-blue-500" />, desc: 'Automatically selects best free model' },
  { id: 'coding', label: 'Coding AI', icon: <Code className="w-3.5 h-3.5 text-emerald-500" />, desc: 'Python, JS, React, bug fixing, SQL' },
  { id: 'reasoning', label: 'Reasoning AI', icon: <Brain className="w-3.5 h-3.5 text-purple-500" />, desc: 'Deep logic, architecture, analysis' },
  { id: 'finance', label: 'Finance AI', icon: <TrendingUp className="w-3.5 h-3.5 text-amber-500" />, desc: 'Stocks, balance sheets, market data' },
  { id: 'general', label: 'General AI', icon: <Compass className="w-3.5 h-3.5 text-indigo-500" />, desc: 'Everyday conversations & answers' },
];

export const Navbar: React.FC<NavbarProps> = ({
  user,
  providerStatus,
  aiMode,
  onSelectAiMode,
  onNewChat,
  onOpenSettings,
  onOpenIntegrations,
  onExportMarkdown,
  hasMessagesToExport = false,
  onOpenAuth,
  onLogout,
  darkMode,
  onToggleDarkMode,
  onToggleSidebar,
}) => {
  const [modeDropdownOpen, setModeDropdownOpen] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const mobileMenuRef = React.useRef<HTMLDivElement>(null);
  const mobilePanelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setModeDropdownOpen(false);
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node) && !mobilePanelRef.current?.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setModeDropdownOpen(false);
        setMobileMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const isConnected = providerStatus?.connection_status === 'connected';
  const currentModeObj = MODE_OPTIONS.find((m) => m.id === aiMode) || MODE_OPTIONS[0];

  return (
    <header className="relative min-h-16 border-b border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md px-2 sm:px-5 py-2 flex items-center gap-2 justify-between z-30 sticky top-0 transition-colors">
      {/* Left: Brand & Sidebar toggle */}
      <div className="flex items-center gap-2 min-w-0 shrink-0">
        <button
          onClick={onToggleSidebar}
          className="min-w-11 min-h-11 flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 rounded-lg transition-colors"
          title="Toggle chat history"
          aria-label="Toggle chat history"
        >
          <Menu className="w-5 h-5" />
        </button>

        <button type="button" className="flex items-center gap-2 min-w-0 select-none" onClick={onNewChat} aria-label="ModelMesh, new chat">
          <ModelMeshLogo className="w-8 h-8 shrink-0" />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight text-base">
                ModelMesh
              </span>
            </div>
          </div>
        </button>

        <button type="button" onClick={onNewChat} className="md:hidden min-w-11 min-h-11 flex items-center justify-center rounded-lg text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="New chat">
          <Plus className="w-5 h-5" />
        </button>

        <button
          onClick={onNewChat}
          className="hidden xl:flex items-center gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700/80 px-2.5 py-1.5 rounded-lg ml-2 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Chat</span>
        </button>
      </div>

      {/* Center: AI Mode Dropdown */}
      <div className="relative hidden md:block md:ml-auto" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setModeDropdownOpen(!modeDropdownOpen)}
          className="flex w-full md:w-auto justify-center items-center gap-1.5 min-h-10 text-xs font-medium text-zinc-800 dark:text-zinc-200 bg-zinc-100/90 dark:bg-zinc-900 hover:bg-zinc-200/80 dark:hover:bg-zinc-800 px-3 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-800 transition-colors shadow-xs"
          aria-expanded={modeDropdownOpen}
          aria-haspopup="menu"
        >
          {currentModeObj.icon}
          <span>{currentModeObj.label}</span>
          <ChevronDown className="w-3 h-3 text-zinc-400 ml-0.5" />
        </button>

        {modeDropdownOpen && (
          <div className="absolute left-0 md:left-1/2 md:-translate-x-1/2 mt-2 w-full md:w-64 bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-800 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
            <div className="px-3 py-1.5 text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              Routing Mode
            </div>
            {MODE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  onSelectAiMode(opt.id);
                  setModeDropdownOpen(false);
                }}
                className={`w-full text-left px-3 py-2 flex items-start gap-2.5 transition-colors ${
                  aiMode === opt.id
                    ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
                }`}
              >
                <div className="mt-0.5">{opt.icon}</div>
                <div>
                  <div className="text-xs font-medium">{opt.label}</div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400">{opt.desc}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right: Export Markdown, Tasks, Provider status, Theme toggle, Settings, User */}
      <div className="flex items-center gap-1.5 sm:gap-2 ml-auto md:ml-0" ref={mobileMenuRef}>
        <button type="button" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden min-w-11 min-h-11 flex items-center justify-center rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Open menu" aria-expanded={mobileMenuOpen} aria-controls="mobile-navigation-menu">
          <Ellipsis className="w-5 h-5" />
        </button>
        {/* Export Current Chat as Markdown Button */}
        {hasMessagesToExport && onExportMarkdown && (
          <button
            onClick={onExportMarkdown}
            className="hidden md:flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full font-medium transition-all bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 shadow-2xs"
            title="Export chat as Markdown (.md)"
            aria-label="Export chat as Markdown"
          >
            <Download className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
            <span className="hidden md:inline">Export</span>
          </button>
        )}

        {/* Integrations Button */}
        <button
          onClick={onOpenIntegrations}
          className="hidden md:flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full font-medium transition-all bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 shadow-2xs"
          title="Settings → Integrations (Google Drive, GitHub)"
        >
          <Blocks className="w-3.5 h-3.5 text-indigo-500" />
          <span className="hidden sm:inline">Integrations</span>
        </button>

        {/* OpenRouter Connection Status Pill */}
        <button
          onClick={onOpenSettings}
          className={`hidden lg:flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full font-medium transition-all ${
            isConnected
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60'
              : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40 hover:bg-amber-100 dark:hover:bg-amber-900/60'
          }`}
          title="OpenRouter Provider Settings"
        >
          {isConnected ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="hidden sm:inline">OpenRouter:</span>
              <span className="font-semibold">Connected</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="hidden sm:inline">OpenRouter:</span>
              <span className="font-semibold">Connect</span>
            </>
          )}
        </button>

        {/* Theme Toggle */}
        <button
          onClick={onToggleDarkMode}
          className="hidden lg:flex p-2 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 rounded-lg transition-colors"
          title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label="Toggle theme"
        >
          {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Settings button */}
        <button
          onClick={onOpenSettings}
          className="hidden md:flex p-2 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 rounded-lg transition-colors"
          title="Provider & Routing Settings"
          aria-label="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* User profile or sign in */}
        {user ? (
          <div className="hidden md:flex items-center gap-1.5 pl-1 border-l border-zinc-200 dark:border-zinc-800">
            <div
              className="w-7 h-7 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-xs font-semibold text-zinc-800 dark:text-zinc-200 uppercase select-none"
              title={user.email}
            >
              {user.name ? user.name[0] : user.email[0]}
            </div>
            <button
              onClick={onLogout}
              className="p-1.5 text-zinc-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={onOpenAuth}
            className="hidden md:block text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-3 min-h-10 rounded-lg transition-colors shadow-xs"
          >
            Sign In
          </button>
        )}
      </div>
      {mobileMenuOpen && (
        <div ref={mobilePanelRef} id="mobile-navigation-menu" className="absolute md:hidden right-2 top-14 w-[min(19rem,calc(100vw-1rem))] max-h-[calc(100dvh-5rem)] overflow-y-auto p-2 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl z-50">
          <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Model mode</div>
          {MODE_OPTIONS.map((opt) => <button key={opt.id} type="button" className={`mobile-menu-item ${aiMode === opt.id ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' : ''}`} onClick={() => { onSelectAiMode(opt.id); setMobileMenuOpen(false); }}>{opt.icon}<span>{opt.label}</span></button>)}
          <div className="my-1 border-t border-zinc-200 dark:border-zinc-800" />
          <button className="mobile-menu-item" onClick={() => { onOpenIntegrations(); setMobileMenuOpen(false); }}><Blocks className="w-4 h-4" /> Integrations</button>
          <button className="mobile-menu-item" onClick={() => { onOpenSettings(); setMobileMenuOpen(false); }}><Settings className="w-4 h-4" /> OpenRouter settings</button>
          {hasMessagesToExport && onExportMarkdown && <button className="mobile-menu-item" onClick={() => { onExportMarkdown(); setMobileMenuOpen(false); }}><Download className="w-4 h-4" /> Export chat</button>}
          <button className="mobile-menu-item" onClick={() => { onToggleDarkMode(); setMobileMenuOpen(false); }}>{darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />} {darkMode ? 'Light theme' : 'Dark theme'}</button>
          {!user && <button className="mobile-menu-item" onClick={() => { onOpenAuth(); setMobileMenuOpen(false); }}>Sign in or create account</button>}
          {user && <button className="mobile-menu-item text-red-600" onClick={() => { onLogout(); setMobileMenuOpen(false); }}><LogOut className="w-4 h-4" /> Sign out</button>}
        </div>
      )}
    </header>
  );
};
