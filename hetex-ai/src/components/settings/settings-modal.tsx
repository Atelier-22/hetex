"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  X,
  Search,
  Settings as SettingsIcon,
  Bell,
  UserCog,
  Puzzle,
  Mic,
  CreditCard,
  ShieldCheck,
  Database,
  KeyRound,
  User,
  Keyboard,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useSettings, type SectionId } from "./settings-context";

type NavItem = {
  id: SectionId;
  label: string;
  icon: LucideIcon;
  /** Extra words the search should match — the labels people actually type. */
  keywords: string[];
};

const NAV: NavItem[] = [
  {
    id: "general",
    label: "General",
    icon: SettingsIcon,
    keywords: ["theme", "dark", "light", "appearance", "accent", "colour", "color", "text size", "font", "language", "higher intelligence", "model", "version", "updates"],
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: Bell,
    keywords: ["push", "email", "responses", "tasks", "usage", "tips", "marketing", "alerts"],
  },
  {
    id: "personalization",
    label: "Personalization",
    icon: UserCog,
    keywords: ["custom instructions", "memory", "assistant name", "response style", "tone"],
  },
  {
    id: "plugins",
    label: "Plugins",
    icon: Puzzle,
    keywords: ["integrations", "connect", "tools", "apps"],
  },
  {
    id: "voice",
    label: "Voice",
    icon: Mic,
    keywords: ["read aloud", "speech", "dictation", "microphone", "tts"],
  },
  {
    id: "billing",
    label: "Billing",
    icon: CreditCard,
    keywords: ["plan", "subscription", "upgrade", "invoice", "payment"],
  },
  {
    id: "data-controls",
    label: "Data controls",
    icon: ShieldCheck,
    keywords: ["export", "delete", "chat history", "training", "privacy", "download"],
  },
  {
    id: "storage",
    label: "Storage",
    icon: Database,
    keywords: ["usage", "files", "size", "space", "attachments"],
  },
  {
    id: "security",
    label: "Security and login",
    icon: KeyRound,
    keywords: ["password", "sessions", "devices", "log out", "sign out", "ip"],
  },
  {
    id: "account",
    label: "Account",
    icon: User,
    keywords: ["profile", "name", "email", "avatar", "delete account"],
  },
  {
    id: "keyboard",
    label: "Keyboard",
    icon: Keyboard,
    keywords: ["shortcuts", "keys", "hotkeys"],
  },
];

export function SettingsModal({
  renderSection,
}: {
  renderSection: (id: SectionId) => React.ReactNode;
}) {
  const { open, section, query, closeSettings, setSection, setQuery } =
    useSettings();
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Escape closes from anywhere inside the dialog, including while a control
  // has focus.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeSettings();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, closeSettings]);

  // The page behind a modal should not scroll with it.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return NAV;
    return NAV.filter(
      (n) =>
        n.label.toLowerCase().includes(q) ||
        n.keywords.some((k) => k.includes(q) || q.includes(k))
    );
  }, [query]);

  // Searching should move you to what you found, not leave you on a section
  // the filtered nav no longer lists.
  useEffect(() => {
    if (!query.trim()) return;
    if (filtered.length > 0 && !filtered.some((n) => n.id === section)) {
      setSection(filtered[0].id);
    }
  }, [query, filtered, section, setSection]);

  if (!open) return null;

  const active = NAV.find((n) => n.id === section);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      {/* Backdrop — clicking outside the panel closes. */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={closeSettings}
        aria-hidden
      />

      <div
        ref={panelRef}
        className="relative flex h-full w-full flex-col overflow-hidden bg-[var(--bg-primary)] shadow-2xl sm:h-[min(46rem,90vh)] sm:max-w-4xl sm:rounded-2xl sm:border sm:border-[var(--border-subtle)] md:flex-row"
      >
        {/* Left nav */}
        <aside className="flex shrink-0 flex-col border-b border-[var(--border-subtle)] bg-[var(--bg-sidebar)] md:w-60 md:border-b-0 md:border-r">
          <div className="flex items-center gap-2 px-3 py-3">
            <button
              onClick={closeSettings}
              aria-label="Close settings"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/10"
            >
              <X size={17} />
            </button>
            <h1 className="text-sm font-semibold">Settings</h1>
          </div>

          <div className="px-3 pb-2">
            <label className="sr-only" htmlFor="settings-search">
              Search settings
            </label>
            <div className="focus-within-accent flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2.5 py-1.5">
              <Search size={13} className="shrink-0 text-[var(--text-secondary)]" />
              <input
                id="settings-search"
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search settings"
                className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--text-secondary)]"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="shrink-0 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:overflow-y-auto md:pb-3">
            {filtered.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setSection(id)}
                aria-current={section === id ? "page" : undefined}
                className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-2.5 py-2 text-left text-sm transition-colors md:w-full ${
                  section === id
                    ? "bg-accent-soft font-medium"
                    : "text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/5"
                }`}
              >
                <Icon size={15} className="shrink-0" />
                {label}
              </button>
            ))}

            {filtered.length === 0 && (
              <p className="px-2.5 py-3 text-xs text-[var(--text-secondary)]">
                Nothing matches “{query}”.
              </p>
            )}
          </nav>
        </aside>

        {/* Right panel */}
        <div className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl px-5 py-6 sm:px-8">
            {active ? (
              renderSection(active.id)
            ) : (
              <p className="text-sm text-[var(--text-secondary)]">
                Select a section.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
