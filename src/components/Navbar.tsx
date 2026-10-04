import React from "react";
import { Menu, Download, Search, Settings, UserRound } from "lucide-react";
import { HelloOrb } from "./HomePage.tsx";
import type { User } from "../types/index.ts";
interface NavbarProps {
  user: User | null;
  onNewChat: () => void;
  onOpenSettings: () => void;
  onOpenIntegrations: () => void;
  onExportMarkdown?: () => void;
  hasMessagesToExport?: boolean;
  onOpenAuth: () => void;
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
}
export const Navbar: React.FC<NavbarProps> = ({
  user,
  onNewChat,
  onOpenSettings,
  onExportMarkdown,
  hasMessagesToExport,
  onOpenAuth,
  onToggleSidebar,
  isSidebarOpen,
}) => (
  <header className="hello-header">
    <div className="hello-header-brand">
      <button
        className="hello-icon-button"
        onClick={onToggleSidebar}
        aria-expanded={isSidebarOpen}
        aria-label={isSidebarOpen ? "Close menu" : "Open menu"}
      >
        <Menu />
      </button>
      <button
        className="hello-brand"
        onClick={onNewChat}
        aria-label="hello home"
      >
        <HelloOrb small />
        <span>hello👋</span>
      </button>
    </div>
    <div className="hello-header-actions">
      {hasMessagesToExport ? (
        <button
          className="hello-icon-button"
          onClick={onExportMarkdown}
          aria-label="Export conversation"
        >
          <Download />
        </button>
      ) : (
        <button
          className="hello-icon-button"
          onClick={onToggleSidebar}
          aria-label="Search conversations"
        >
          <Search />
        </button>
      )}
      <button
        className="hello-icon-button"
        onClick={onOpenSettings}
        aria-label="Settings"
      >
        <Settings />
      </button>
      <button
        className="hello-icon-button"
        onClick={user ? onOpenSettings : onOpenAuth}
        aria-label={user ? "Account settings" : "Sign in"}
        title={user?.name || "Sign in"}
      >
        {user ? (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500/30 text-sm">
            {(user.name || user.email).slice(0, 1).toUpperCase()}
          </span>
        ) : (
          <UserRound />
        )}
      </button>
    </div>
  </header>
);
