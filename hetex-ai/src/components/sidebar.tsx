"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  MoreHorizontal,
  Pencil,
  Trash2,
  Pin,
  PinOff,
  X,
  ChevronRight,
  User,
} from "lucide-react";
import { HetexIcon, HetexLockup } from "./logo";
import { apiFetch } from "@/lib/api-client";
import { useSettings } from "./settings/settings-context";

type ConversationSummary = {
  id: string;
  title: string;
  updatedAt?: string;
  pinned?: boolean;
};

// Settings is not in this list: it opens a modal rather than navigating, so it
// renders as a button below.
const navItems = [
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/library", label: "Library", icon: Library },
];

const COLLAPSED_KEY = "hetex.sidebar.collapsed";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const { openSettings } = useSettings();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [accountOpen, setAccountOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSED_KEY) === "1");
    } catch {
      /* no stored preference available */
    }
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        /* not persistable here — still works for this session */
      }
      return next;
    });
  }, []);

  const load = useCallback(() => {
    if (!session) return;
    apiFetch<ConversationSummary[]>("/conversations")
      .then(setConversations)
      .catch(() => setConversations([]))
      .finally(() => setLoading(false));
  }, [session]);

  useEffect(load, [load, pathname]);

  useEffect(() => {
    setMobileOpen(false);
    setMenuFor(null);
    setAccountOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target as Node;
      if (listRef.current && !listRef.current.contains(target)) setMenuFor(null);
      if (accountRef.current && !accountRef.current.contains(target)) {
        setAccountOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuFor(null);
        setAccountOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const { pinned, recent } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = q
      ? conversations.filter((c) =>
          (c.title || "New Chat").toLowerCase().includes(q)
        )
      : conversations;
    return {
      pinned: matches.filter((c) => c.pinned),
      recent: matches.filter((c) => !c.pinned),
    };
  }, [conversations, query]);

  async function patchConversation(
    id: string,
    body: Record<string, unknown>,
    optimistic: (c: ConversationSummary) => ConversationSummary
  ) {
    const previous = conversations;
    setConversations((prev) => prev.map((c) => (c.id === id ? optimistic(c) : c)));
    try {
      await apiFetch(`/conversations/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      load();
    } catch {
      setConversations(previous);
    }
  }

  function renameConversation(id: string) {
    const title = renameValue.trim();
    setRenamingId(null);
    if (!title) return;
    patchConversation(id, { title }, (c) => ({ ...c, title }));
  }

  function togglePin(c: ConversationSummary) {
    setMenuFor(null);
    patchConversation(c.id, { pinned: !c.pinned }, (x) => ({
      ...x,
      pinned: !c.pinned,
    }));
  }

  async function deleteConversation(id: string) {
    if (!confirm("Delete this conversation? This can't be undone.")) return;

    const previous = conversations;
    setConversations((prev) => prev.filter((c) => c.id !== id));
    setMenuFor(null);
    try {
      await apiFetch(`/conversations/${id}`, { method: "DELETE" });
      if (pathname === `/chat/${id}`) router.push("/chat");
    } catch {
      setConversations(previous);
    }
  }

  function renderConversation(c: ConversationSummary) {
    const active = pathname === `/chat/${c.id}`;

    if (renamingId === c.id) {
      return (
        <input
          key={c.id}
          autoFocus
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onBlur={() => renameConversation(c.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter") renameConversation(c.id);
            if (e.key === "Escape") setRenamingId(null);
          }}
          className="border-accent rounded-lg border bg-[var(--bg-secondary)] px-2 py-1.5 text-sm outline-none"
        />
      );
    }

    return (
      <div key={c.id} className="group relative flex items-center">
        <Link
          href={`/chat/${c.id}`}
          className={`flex-1 truncate rounded-lg py-1.5 pl-2.5 pr-7 text-sm ${
            active
              ? "bg-black/5 text-[var(--text-primary)] dark:bg-white/10"
              : "text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/5"
          }`}
        >
          {c.title || "New Chat"}
        </Link>

        <button
          onClick={(e) => {
            e.preventDefault();
            setMenuFor(menuFor === c.id ? null : c.id);
          }}
          aria-label={`Options for ${c.title || "New Chat"}`}
          className={`absolute right-1 rounded p-1 text-[var(--text-secondary)] transition-opacity hover:bg-black/10 dark:hover:bg-white/10 ${
            menuFor === c.id
              ? "opacity-100"
              : "opacity-0 focus:opacity-100 group-hover:opacity-100"
          }`}
        >
          <MoreHorizontal size={14} />
        </button>

        {menuFor === c.id && (
          <div className="absolute right-1 top-full z-20 mt-1 w-40 overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] py-1 shadow-lg">
            <button
              onClick={() => togglePin(c)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
            >
              {c.pinned ? <PinOff size={13} /> : <Pin size={13} />}
              {c.pinned ? "Unpin" : "Pin"}
            </button>
            <button
              onClick={() => {
                setRenameValue(c.title || "");
                setRenamingId(c.id);
                setMenuFor(null);
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
            >
              <Pencil size={13} /> Rename
            </button>
            <button
              onClick={() => deleteConversation(c.id)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-hetex-red-500 hover:bg-hetex-red-500/10"
            >
              <Trash2 size={13} /> Delete
            </button>
          </div>
        )}
      </div>
    );
  }

  const displayName = session?.user?.name || session?.user?.email || "Account";
  const initials = (displayName.match(/\b\w/g) ?? ["?"])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const content = (
    <div
      className="flex h-full flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-sidebar)] transition-[width] duration-200"
      style={{ width: collapsed ? 64 : 260 }}
    >
      <div className="flex items-center justify-between px-3 py-4">
        {!collapsed && (
          // The lockup already contains the wordmark, so the adjacent "Hetex AI"
          // text it replaces would have been a duplicate.
          <Link href="/chat" aria-label="Hetex AI — new chat">
            <HetexLockup height={28} priority />
          </Link>
        )}
        {collapsed && (
          <Link href="/chat" className="mx-auto" aria-label="Hetex AI — new chat">
            <HetexIcon size={28} priority />
          </Link>
        )}
        <button
          onClick={toggleCollapsed}
          className="hidden rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-black/5 md:block dark:hover:bg-white/5"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
        </button>
        <button
          onClick={() => setMobileOpen(false)}
          className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-black/5 md:hidden dark:hover:bg-white/5"
          aria-label="Close menu"
        >
          <X size={18} />
        </button>
      </div>

      <div className="px-3">
        <button
          onClick={() => router.push("/chat")}
          className="bg-accent-gradient flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
          title="New chat"
        >
          <MessageSquarePlus size={16} />
          {!collapsed && "New Chat"}
        </button>
      </div>

      {!collapsed && (
        <div className="mt-4 px-3">
          <label className="sr-only" htmlFor="chat-search">
            Search chats
          </label>
          <div className="focus-within-accent flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2.5 py-1.5">
            <Search size={14} className="shrink-0 text-[var(--text-secondary)]" />
            <input
              id="chat-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search chats"
              className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--text-secondary)]"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="shrink-0 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>
      )}

      <nav className="mt-4 flex flex-col gap-1 px-3">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            title={label}
            className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors ${
              pathname === href
                ? "bg-accent-soft"
                : "text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/5"
            } ${collapsed ? "justify-center" : ""}`}
          >
            <Icon size={16} />
            {!collapsed && label}
          </Link>
        ))}

        <button
          onClick={() => openSettings()}
          title="Settings"
          className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-black/5 dark:hover:bg-white/5 ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <Settings size={16} />
          {!collapsed && "Settings"}
        </button>
      </nav>

      {!collapsed && (
        <div className="mt-4 flex-1 overflow-y-auto px-3" ref={listRef}>
          {loading && (
            <div className="flex flex-col gap-1.5 px-1 py-1">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-6 animate-pulse rounded-md bg-black/5 dark:bg-white/5"
                />
              ))}
            </div>
          )}

          {pinned.length > 0 && (
            <>
              <p className="mb-1 flex items-center gap-1 px-1 text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">
                <Pin size={10} /> Pinned
              </p>
              <div className="mb-3 flex flex-col gap-0.5">
                {pinned.map(renderConversation)}
              </div>
            </>
          )}

          {(recent.length > 0 || (!loading && conversations.length === 0)) && (
            <p className="mb-1 px-1 text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">
              Recents
            </p>
          )}

          {!loading && conversations.length === 0 && (
            <p className="px-1 py-2 text-xs text-[var(--text-secondary)]">
              No conversations yet. Start one above.
            </p>
          )}

          {!loading &&
            conversations.length > 0 &&
            pinned.length === 0 &&
            recent.length === 0 && (
              <p className="px-1 py-2 text-xs text-[var(--text-secondary)]">
                Nothing matches “{query}”.
              </p>
            )}

          <div className="flex flex-col gap-0.5">
            {recent.map(renderConversation)}
          </div>
        </div>
      )}

      <div
        className="relative mt-auto border-t border-[var(--border-subtle)] p-2"
        ref={accountRef}
      >
        {accountOpen && !collapsed && (
          <div className="absolute bottom-full left-2 right-2 z-30 mb-1 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] py-1 shadow-lg">
            <div className="border-b border-[var(--border-subtle)] px-3 py-2">
              <p className="truncate text-sm font-medium">{displayName}</p>
              <p className="truncate text-xs text-[var(--text-secondary)]">
                {session?.user?.email}
              </p>
            </div>
            <button
              onClick={() => {
                setAccountOpen(false);
                openSettings("account");
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
            >
              <User size={14} /> Profile &amp; account
            </button>
            <button
              onClick={() => {
                setAccountOpen(false);
                openSettings("general");
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
            >
              <Settings size={14} /> Settings
            </button>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-hetex-red-500 hover:bg-hetex-red-500/10"
            >
              <LogOut size={14} /> Log out
            </button>
          </div>
        )}

        {collapsed ? (
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/5"
            aria-label="Log out"
            title="Log out"
          >
            <LogOut size={16} />
          </button>
        ) : (
          <button
            onClick={() => setAccountOpen((v) => !v)}
            aria-expanded={accountOpen}
            className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-left hover:bg-black/5 dark:hover:bg-white/5"
          >
            <span className="bg-accent-gradient flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white">
              {initials}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{displayName}</span>
            </span>
            <ChevronRight
              size={14}
              className={`shrink-0 text-[var(--text-secondary)] transition-transform ${
                accountOpen ? "-rotate-90" : ""
              }`}
            />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <div className="sticky top-0 hidden h-screen md:block">{content}</div>

      {/* Mobile */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-3 top-3 z-30 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-2 md:hidden"
        aria-label="Open menu"
      >
        <PanelLeft size={18} />
      </button>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="w-[260px]">{content}</div>
          <div
            className="flex-1 bg-black/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
        </div>
      )}
    </>
  );
}
