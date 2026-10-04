import React from "react";
import {
  MessageCircle,
  Users,
  Mic,
  Phone,
  Heart,
  GraduationCap,
  Folder,
  Link,
  CalendarDays,
  Puzzle,
  History,
  ChartNoAxesColumnIncreasing,
  Settings,
  ChevronRight,
  Mail,
  HardDrive,
  Github,
  Triangle,
  Zap,
} from "lucide-react";
import type { Chat } from "../types/index.ts";
interface HomePageProps {
  conversations: Chat[];
  onSelectConversation: (id: string) => void;
  onNewChat: (prompt?: string) => void;
  onOpenSetup: () => void;
  onOpenHistory: () => void;
}
export function HelloOrb({ small = false }: { small?: boolean }) {
  return (
    <span
      className={`hello-orb ${small ? "hello-orb-small" : ""}`}
      aria-hidden="true"
    >
      <span className="orb-face">
        <i />
        <i />
        <b />
      </span>
    </span>
  );
}
export function HomePage({
  conversations,
  onSelectConversation,
  onNewChat,
  onOpenSetup,
  onOpenHistory,
}: HomePageProps) {
  const recent = [...conversations]
    .sort(
      (a, b) =>
        Date.parse(b.updated_at || b.created_at) -
        Date.parse(a.updated_at || a.created_at),
    )
    .slice(0, 3);
  const modeUpdateLabel = "Updating 30 Nov";
  const modeUpdateTitle = "Planned update: 30 November 2026. Under development.";
  const features = [
    {
      label: "New Chat",
      Icon: MessageCircle,
      color: "blue",
      action: () => onNewChat(),
    },
    { label: "Group Chat", Icon: Users, color: "purple" },
    { label: "Voice Chat", Icon: Mic, color: "pink" },
    { label: "Calls", Icon: Phone, color: "green" },
    {
      label: "Friend Mode",
      Icon: Heart,
      color: "orange",
      updatePending: true,
    },
    {
      label: "Teacher Mode",
      Icon: GraduationCap,
      color: "blue",
      updatePending: true,
    },
    { label: "Projects", Icon: Folder, color: "purple" },
    { label: "Integrations", Icon: Link, color: "cyan", action: onOpenSetup },
    { label: "Scheduling", Icon: CalendarDays, color: "orange" },
    { label: "Plugins", Icon: Puzzle, color: "purple", action: onOpenSetup },
    { label: "History", Icon: History, color: "blue", action: onOpenHistory },
  ];
  const roles = [
    {
      name: "Friend",
      detail: "Chat, ideas, entertainment",
      Icon: Heart,
      color: "pink",
      updatePending: true,
    },
    {
      name: "Teacher",
      detail: "Study help, explanations",
      Icon: GraduationCap,
      color: "blue",
      updatePending: true,
    },
    {
      name: "Business",
      detail: "Analysis, strategy",
      Icon: ChartNoAxesColumnIncreasing,
      color: "green",
      prompt:
        "Help me critically evaluate a business idea. Ask me about the customer and problem first.",
    },
    {
      name: "Project",
      detail: "Planning, tasks",
      Icon: Folder,
      color: "purple",
      prompt:
        "Help me plan a project. Ask me about the goal and deadline first.",
    },
    {
      name: "Custom",
      detail: "Your own AI role",
      Icon: Settings,
      color: "slate",
      prompt: "I want you to take on this role: ",
    },
  ];
  const tools = [
    { name: "Gmail", Icon: Mail, color: "pink" },
    { name: "Drive", Icon: HardDrive, color: "green" },
    { name: "Calendar", Icon: CalendarDays, color: "blue" },
    { name: "GitHub", Icon: Github, color: "slate" },
    { name: "Vercel", Icon: Triangle, color: "slate" },
    { name: "Supabase", Icon: Zap, color: "green" },
    { name: "Plugins", Icon: Puzzle, color: "purple" },
  ];
  return (
    <div className="hello-home">
      <section className="hello-hero" aria-labelledby="welcome-title">
        <div className="hero-copy">
          <h1 id="welcome-title">hello👋</h1>
          <p>
            People and AI, together
            <br />
            in one conversation.
          </p>
        </div>
        <div className="hero-universe">
          <span className="orbit orbit-one" />
          <span className="orbit orbit-two" />
          <HelloOrb />
        </div>
      </section>
      <nav className="hello-features" aria-label="Quick actions">
        {features.map(({ label, Icon, color, action, updatePending }) => (
          <button
            key={label}
            className={`hello-tile tone-${color}`}
            onClick={action}
            disabled={!action}
            title={updatePending ? modeUpdateTitle : !action ? `${label} — coming soon` : label}
          >
            <Icon aria-hidden="true" />
            <span>{label}</span>
            {!action && <small>{updatePending ? modeUpdateLabel : "Coming soon"}</small>}
          </button>
        ))}
      </nav>
      <section className="hello-recent" aria-labelledby="recent-title">
        <div className="hello-section-heading">
          <h2 id="recent-title">Continue your conversation</h2>
          <button onClick={onOpenHistory}>
            See all <ChevronRight size={16} />
          </button>
        </div>
        {recent.length ? (
          recent.map((c) => (
            <button
              className="hello-conversation"
              key={c.id}
              onClick={() => onSelectConversation(c.id)}
            >
              <HelloOrb small />
              <span className="conversation-copy">
                <strong>{c.title}</strong>
                <span>Continue your conversation</span>
              </span>
              <span className="conversation-meta">
                <time
                  dateTime={new Date(
                    c.updated_at || c.created_at,
                  ).toISOString()}
                >
                  {new Date(c.updated_at || c.created_at).toLocaleDateString(
                    undefined,
                    {
                      month: "short",
                      day: "numeric",
                    },
                  )}
                </time>
              </span>
            </button>
          ))
        ) : (
          <div className="hello-empty">
            <MessageCircle size={24} />
            <p>Your conversations will appear here.</p>
            <button onClick={() => onNewChat()}>
              Start your first chat <ChevronRight size={15} />
            </button>
          </div>
        )}
      </section>
      <section aria-labelledby="roles-title">
        <div className="hello-section-heading">
          <h2 id="roles-title">AI Roles</h2>
          <span className="section-note">Choose a conversation style</span>
        </div>
        <div className="hello-roles">
          {roles.map(({ name, detail, Icon, color, prompt, updatePending }) => (
            <button
              key={name}
              className={`hello-role tone-${color}`}
              onClick={updatePending ? undefined : () => onNewChat(prompt)}
              disabled={updatePending}
              title={updatePending ? modeUpdateTitle : name}
            >
              <Icon aria-hidden="true" />
              <strong>{name}</strong>
              <span>{detail}</span>
              {updatePending && <small className="text-[10px] text-slate-300">{modeUpdateLabel}</small>}
            </button>
          ))}
        </div>
      </section>
      <section aria-labelledby="tools-title">
        <div className="hello-section-heading">
          <h2 id="tools-title">Connected Tools</h2>
          <button onClick={onOpenSetup}>
            Manage <ChevronRight size={16} />
          </button>
        </div>
        <div className="hello-tools">
          {tools.map(({ name, Icon, color }) => (
            <button
              className={`hello-tool tone-${color}`}
              key={name}
              onClick={onOpenSetup}
              disabled={!["Drive", "Plugins"].includes(name)}
              title={
                ["Drive", "Plugins"].includes(name)
                  ? `Manage ${name} integration`
                  : `${name} — coming soon`
              }
            >
              <span>
                <Icon aria-hidden="true" />
              </span>
              {name}
              {!["Drive", "Plugins"].includes(name) && (
                <small>Coming soon</small>
              )}
            </button>
          ))}
        </div>
        <p className="hello-tools-note">
          Manage connections and check availability in settings.
        </p>
      </section>
      <section aria-labelledby="schedule-title">
        <div className="hello-section-heading">
          <h2 id="schedule-title">Today’s Schedule</h2>
          <span className="section-note">Coming soon</span>
        </div>
        <div className="hello-schedule">
          <CalendarDays aria-hidden="true" />
          <div>
            <strong>A little space for your day</strong>
            <p>Scheduled check-ins and reminders are on the way.</p>
          </div>
        </div>
      </section>
      <footer className="hello-footer">People + AI + Communication</footer>
    </div>
  );
}
