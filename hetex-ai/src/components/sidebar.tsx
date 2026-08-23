"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import {
  MessageSquarePlus,
  Search,
  FolderKanban,
  Library,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeft,
  Sparkles,
} from "lucide-react";
import { ThemeToggle } from "./theme-toggle";

type ConversationSummary = { id: string; title: string };

const navItems = [
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/library", label: "Library", icon: Library },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);

  useEffect(() => {
    if (!session) return;
    fetch("/api/conversations")
      .then((r) => (r.ok ? r.json() : []))
      .then(setConversations)
      .catch(() => setConversations([]));
  }, [session, pathname]);

  const content = (
    <div
      className="flex h-full flex-col bg-[var(--bg-sidebar)] border-r border-[var(--border-subtle)]"
      style={{ width: collapsed ? 64 : 260 }}
    >
      <div className="flex items-center justify-between px-3 py-4">
        {!collapsed && (
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-hetex-green-500 to-hetex-blue-500 text-white">
              <Sparkles size={15} />
            </span>
            <span>Hetex AI</span>
          </Link>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/5"
          aria-label="Toggle sidebar"
        >
          {collapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      <div className="px-3">
        <button
          onClick={() => router.push("/")}
          className="flex w-full items-center gap-2 rounded-xl bg-gradient-to-r from-hetex-green-500 to-hetex-blue-500 px-3 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90"
        >
          <MessageSquarePlus size={16} />
          {!collapsed && "New Chat"}
        </button>
      </div>

      {!collapsed && (
        <div className="mt-4 px-3">
          <div className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] px-2.5 py-1.5 text-sm text-[var(--text-secondary)]">
            <Search size={14} />
            <span>Search chats</span>
          </div>
        </div>
      )}

      <nav className="mt-4 flex flex-col gap-1 px-3">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors ${
              pathname === href
                ? "bg-hetex-green-100 text-hetex-green-800 dark:bg-white/10 dark:text-white"
                : "text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/5"
            }`}
          >
            <Icon size={16} />
            {!collapsed && label}
          </Link>
        ))}
      </nav>

      {!collapsed && (
        <div className="mt-4 flex-1 overflow-y-auto px-3">
          <p className="mb-1 px-1 text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">
            Recent
          </p>
          <div className="flex flex-col gap-0.5">
            {conversations.slice(0, 20).map((c) => (
              <Link
                key={c.id}
                href={`/chat/${c.id}`}
                className={`truncate rounded-lg px-2.5 py-1.5 text-sm ${
                  pathname === `/chat/${c.id}`
                    ? "bg-black/5 dark:bg-white/10"
                    : "text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/5"
                }`}
              >
                {c.title || "New Chat"}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-[var(--border-subtle)] px-3 py-3">
        {!collapsed && (
          <span className="truncate text-sm text-[var(--text-secondary)]">
            {session?.user?.email ?? "Guest"}
          </span>
        )}
        <div className="flex items-center gap-1">
          {!collapsed && <ThemeToggle />}
          {session && (
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/5"
              aria-label="Log out"
              title="Log out"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block h-screen sticky top-0">{content}</div>

      {/* Mobile */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed left-3 top-3 z-30 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-2"
        aria-label="Open menu"
      >
        <PanelLeft size={18} />
      </button>
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="w-[260px]">{content}</div>
          <div
            className="flex-1 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
        </div>
      )}
    </>
  );
}
