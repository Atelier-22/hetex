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
  Sparkles,
  MoreHorizontal,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { apiFetch } from "@/lib/api-client";

type ConversationSummary = { id: string; title: string; updatedAt?: string };

const navItems = [
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/library", label: "Library", icon: Library },
  { href: "/settings", label: "Settings", icon: Settings },
];

const COLLAPSED_KEY = "hetex.sidebar.collapsed";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  // Restore the collapsed preference. localStorage is per-browser and can throw
  // in a private window, so a failure just means the default.
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
        /* not persistable here — the toggle still works for this session */
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

  // Navigating on a phone should dismiss the drawer, otherwise it covers the
  // page you just opened.
  useEffect(() => {
    setMobileOpen(false);
    setMenuFor(null);
  }, [pathname]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuFor(null);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) =>
      (c.title || "New Chat").toLowerCase().includes(q)
    );
  }, [conversations, query]);

  async function renameConversation(id: string) {
    const title = renameValue.trim();
    setRenamingId(null);
    if (!title) return;

    const previous = conversations;
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title } : c))
    );
    try {
      await apiFetch(`/conversations/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ title }),
      });
    } catch {
      setConversations(previous);
    }
  }

  async function deleteConversation(id: string) {
    if (!confirm("Delete this conversation? This can't be undone.")) return;

    const previous = conversations;
    setConversations((prev) => prev.filter((c) => c.id !== id));
    setMenuFor(null);
    try {
      await apiFetch(`/conversations/${id}`, { method: "DELETE" });
      if (pathname === `/chat/${id}`) router.push("/");
    } catch {
      setConversations(previous);
    }
  }

  const content = (
    <div
      className="flex h-full flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-sidebar)] transition-[width] duration-200"
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
          onClick={() => router.push("/")}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-hetex-green-500 to-hetex-blue-500 px-3 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
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
          <div className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2.5 py-1.5 focus-within:border-hetex-green-500">
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
                ? "bg-hetex-green-100 text-hetex-green-800 dark:bg-white/10 dark:text-white"
                : "text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/5"
            } ${collapsed ? "justify-center" : ""}`}
          >
            <Icon size={16} />
            {!collapsed && label}
          </Link>
        ))}
      </nav>

      {!collapsed && (
        <div className="mt-4 flex-1 overflow-y-auto px-3" ref={menuRef}>
          <p className="mb-1 px-1 text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">
            Recent
          </p>

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

          {!loading && conversations.length === 0 && (
            <p className="px-1 py-2 text-xs text-[var(--text-secondary)]">
              No conversations yet. Start one above.
            </p>
          )}

          {!loading && conversations.length > 0 && filtered.length === 0 && (
            <p className="px-1 py-2 text-xs text-[var(--text-secondary)]">
              Nothing matches “{query}”.
            </p>
          )}

          <div className="flex flex-col gap-0.5">
            {filtered.map((c) => {
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
                    className="rounded-lg border border-hetex-green-500 bg-[var(--bg-secondary)] px-2 py-1.5 text-sm outline-none"
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
                    <div className="absolute right-1 top-full z-20 mt-1 w-36 overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] py-1 shadow-lg">
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
            })}
          </div>
        </div>
      )}

      <div
        className={`mt-auto flex items-center gap-2 border-t border-[var(--border-subtle)] px-3 py-3 ${
          collapsed ? "flex-col" : "justify-between"
        }`}
      >
        {!collapsed && (
          <span
            className="truncate text-sm text-[var(--text-secondary)]"
            title={session?.user?.email ?? undefined}
          >
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
