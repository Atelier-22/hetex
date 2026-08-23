"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import {
  Trash2,
  Download,
  Palette,
  Type,
  Sparkles,
  Mic,
  Volume2,
  Shield,
  Database,
  KeyRound,
  UserCog,
  Keyboard,
  Brain,
  MessageSquare,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { usePreferences } from "@/components/preferences";
import { apiFetch } from "@/lib/api-client";
import { API_BASE_URL } from "@/lib/api";

type MemoryEntry = { id: string; content: string; createdAt: string };
type Storage = {
  conversations: number;
  messages: number;
  projects: number;
  memoryEntries: number;
  assets: number;
  totalBytes: number;
};

const ACCENTS = [
  { value: "green", label: "Green", swatch: "#14b366" },
  { value: "blue", label: "Blue", swatch: "#3178f5" },
  { value: "violet", label: "Violet", swatch: "#7c5cf0" },
  { value: "amber", label: "Amber", swatch: "#d98c05" },
  { value: "rose", label: "Rose", swatch: "#e0245e" },
];

const SHORTCUTS = [
  { keys: "Enter", action: "Send message (when enabled below)" },
  { keys: "Shift + Enter", action: "New line" },
  { keys: "Esc", action: "Close an open menu" },
];

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SettingsPage() {
  const { data: session, update: updateSession } = useSession();
  const { prefs, update, error: prefsError } = usePreferences();

  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [newMemory, setNewMemory] = useState("");
  const [usage, setUsage] = useState<{
    totals: Record<string, number>;
    plan: string;
  }>({ totals: {}, plan: "Free" });
  const [storage, setStorage] = useState<Storage | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  const [displayName, setDisplayName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [deletePassword, setDeletePassword] = useState("");

  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<MemoryEntry[]>("/memory").then(setMemories).catch(() => {});
    apiFetch<{ totals: Record<string, number>; plan: string }>("/usage")
      .then(setUsage)
      .catch(() => {});
    apiFetch<Storage>("/account/storage").then(setStorage).catch(() => {});
  }, []);

  useEffect(() => {
    setDisplayName(session?.user?.name ?? "");
  }, [session?.user?.name]);

  // Voices load asynchronously in most browsers — the first call routinely
  // returns an empty array, and the event is the only reliable signal.
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const read = () => setVoices(window.speechSynthesis.getVoices());
    read();
    window.speechSynthesis.addEventListener("voiceschanged", read);
    return () =>
      window.speechSynthesis.removeEventListener("voiceschanged", read);
  }, []);

  const combinedError = error ?? prefsError;

  function flash(message: string) {
    setNotice(message);
    setError(null);
    setTimeout(() => setNotice(null), 2500);
  }

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  async function addMemory() {
    if (!newMemory.trim()) return;
    await run("memory", async () => {
      const entry = await apiFetch<MemoryEntry>("/memory", {
        method: "POST",
        body: JSON.stringify({ content: newMemory }),
      });
      setMemories((prev) => [entry, ...prev]);
      setNewMemory("");
    });
  }

  async function deleteMemory(id: string) {
    await run("memory", async () => {
      await apiFetch(`/memory/${id}`, { method: "DELETE" });
      setMemories((prev) => prev.filter((m) => m.id !== id));
    });
  }

  async function saveName() {
    if (!displayName.trim() || displayName === session?.user?.name) return;
    await run("name", async () => {
      await apiFetch("/account/profile", {
        method: "PATCH",
        body: JSON.stringify({ displayName }),
      });
      await updateSession({ name: displayName });
      flash("Name updated");
    });
  }

  async function changePassword() {
    await run("password", async () => {
      await apiFetch("/account/password", {
        method: "PATCH",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword("");
      setNewPassword("");
      flash("Password changed");
    });
  }

  async function exportData() {
    await run("export", async () => {
      // The export endpoint needs a bearer token, so it can't be a plain link.
      // Fetch it, then hand the browser a blob to save.
      const blob = await fetch(`${API_BASE_URL}/account/export`, {
        headers: { Authorization: `Bearer ${(session as any)?.accessToken}` },
      }).then((r) => {
        if (!r.ok) throw new Error("Export failed");
        return r.blob();
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `hetex-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      flash("Export downloaded");
    });
  }

  async function eraseData() {
    if (
      !confirm(
        "Delete every conversation, project, memory entry and file? Your account stays, but this cannot be undone."
      )
    )
      return;

    await run("erase", async () => {
      await apiFetch("/account/erase-data", { method: "POST" });
      setMemories([]);
      setStorage(await apiFetch<Storage>("/account/storage"));
      flash("All data deleted");
    });
  }

  async function deleteAccount() {
    if (
      !confirm(
        "Permanently delete your account and everything in it? This cannot be undone."
      )
    )
      return;

    await run("delete-account", async () => {
      await apiFetch("/account", {
        method: "DELETE",
        body: JSON.stringify({ password: deletePassword }),
      });
      await signOut({ callbackUrl: "/login" });
    });
  }

  const memoryCount = useMemo(() => memories.length, [memories]);

  return (
    <div className="h-full overflow-y-auto px-6 py-10 md:px-12">
      <div className="mx-auto max-w-2xl pb-24">
        <h1 className="text-2xl font-semibold">Settings</h1>

        {/* ---------------- Account ---------------- */}
        <SectionHeading icon={UserCog}>Account</SectionHeading>
        <Card>
          <Field label="Display name">
            <div className="flex gap-2">
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                onBlur={saveName}
                onKeyDown={(e) => e.key === "Enter" && saveName()}
                className="focus-accent flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2 text-sm outline-none"
              />
              <button
                onClick={saveName}
                disabled={busy === "name"}
                className="bg-accent rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </Field>
          <Row label="Email">
            <span className="text-sm text-[var(--text-secondary)]">
              {session?.user?.email}
            </span>
          </Row>
        </Card>

        {/* ---------------- Appearance ---------------- */}
        <SectionHeading icon={Palette}>Appearance</SectionHeading>
        <Card>
          <Row label="Theme">
            <ThemeToggle />
          </Row>

          <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
            <Field label="Accent colour">
              <div className="flex flex-wrap gap-2">
                {ACCENTS.map((a) => (
                  <button
                    key={a.value}
                    onClick={() => update({ accentColor: a.value })}
                    aria-label={a.label}
                    aria-pressed={prefs.accentColor === a.value}
                    title={a.label}
                    className={`h-8 w-8 rounded-full border-2 transition-transform ${
                      prefs.accentColor === a.value
                        ? "scale-110 border-[var(--text-primary)]"
                        : "border-transparent hover:scale-105"
                    }`}
                    style={{ backgroundColor: a.swatch }}
                  />
                ))}
              </div>
            </Field>
          </div>

          <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
            <Field label="Text size" icon={Type}>
              <div className="flex gap-2">
                {["small", "medium", "large"].map((size) => (
                  <button
                    key={size}
                    onClick={() => update({ textSize: size })}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm capitalize ${
                      prefs.textSize === size
                        ? "bg-accent-soft border-transparent font-medium"
                        : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/5"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        </Card>

        {/* ---------------- AI ---------------- */}
        <SectionHeading icon={Sparkles}>AI</SectionHeading>
        <Card>
          <Field label="Assistant name">
            <input
              value={prefs.assistantName}
              onChange={(e) => update({ assistantName: e.target.value })}
              className="focus-accent w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2 text-sm outline-none"
            />
          </Field>

          <div className="mt-4">
            <Field label="Response style">
              <select
                value={prefs.responseStyle}
                onChange={(e) => update({ responseStyle: e.target.value })}
                className="focus-accent w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2 text-sm outline-none"
              >
                <option value="concise">Concise</option>
                <option value="balanced">Balanced</option>
                <option value="detailed">Detailed</option>
              </select>
            </Field>
          </div>

          <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
            <Row label="Higher intelligence">
              <Toggle
                checked={prefs.model === "claude-opus-5"}
                onChange={(v) =>
                  update({ model: v ? "claude-opus-5" : "claude-sonnet-4-6" })
                }
              />
            </Row>
            <Hint>
              Uses Claude Opus 5 instead of Sonnet 4.6 — noticeably stronger on
              hard reasoning, and several times more expensive per message.
            </Hint>
          </div>
        </Card>

        {/* ---------------- Chat ---------------- */}
        <SectionHeading icon={MessageSquare}>Chat</SectionHeading>
        <Card>
          <Row label="Send with Enter">
            <Toggle
              checked={prefs.enterToSend}
              onChange={(v) => update({ enterToSend: v })}
            />
          </Row>
          <Hint>When off, Enter adds a new line and the send button submits.</Hint>

          <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
            <Row label="Dictation">
              <Toggle
                checked={prefs.dictationEnabled}
                onChange={(v) => update({ dictationEnabled: v })}
              />
            </Row>
            <Hint>
              <Mic size={11} className="mr-1 inline" />
              Shows a microphone in the composer, using your browser&apos;s speech
              recognition. Chrome and Edge support it; Firefox does not.
            </Hint>
          </div>
        </Card>

        {/* ---------------- Voice ---------------- */}
        <SectionHeading icon={Volume2}>Voice</SectionHeading>
        <Card>
          {voices.length === 0 ? (
            <p className="text-xs text-[var(--text-secondary)]">
              Your browser reports no speech voices, so Read Aloud is
              unavailable here.
            </p>
          ) : (
            <Field label="Read Aloud voice">
              <select
                value={prefs.voiceName ?? ""}
                onChange={(e) =>
                  update({ voiceName: e.target.value || null })
                }
                className="focus-accent w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2 text-sm outline-none"
              >
                <option value="">Browser default</option>
                {voices.map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
              <Hint>
                Used by the speaker button under any reply. Voices come from your
                device, so the list differs between computers.
              </Hint>
            </Field>
          )}
        </Card>

        {/* ---------------- Memory ---------------- */}
        <SectionHeading icon={Brain}>Memory</SectionHeading>
        <Card>
          <Row label="Remember things about me across chats">
            <Toggle
              checked={prefs.memoryEnabled}
              onChange={(v) => update({ memoryEnabled: v })}
            />
          </Row>
          {prefs.memoryEnabled && (
            <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
              <div className="flex gap-2">
                <input
                  value={newMemory}
                  onChange={(e) => setNewMemory(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addMemory()}
                  placeholder="e.g. I prefer concise code explanations"
                  className="focus-accent flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2 text-sm outline-none"
                />
                <button
                  onClick={addMemory}
                  className="bg-accent rounded-lg px-3 py-2 text-sm font-medium text-white"
                >
                  Add
                </button>
              </div>
              <div className="mt-3 flex flex-col gap-1.5">
                {memoryCount === 0 && (
                  <p className="text-xs text-[var(--text-secondary)]">
                    Nothing saved yet. Memory isn&apos;t created automatically
                    from conversations — add what you want remembered here.
                  </p>
                )}
                {memories.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-black/[0.03] px-3 py-1.5 text-sm dark:bg-white/[0.05]"
                  >
                    <span className="min-w-0 flex-1 break-words">{m.content}</span>
                    <button
                      onClick={() => deleteMemory(m.id)}
                      aria-label="Delete memory"
                      className="shrink-0 text-[var(--text-secondary)] hover:text-hetex-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* ---------------- Security ---------------- */}
        <SectionHeading icon={KeyRound}>Security and login</SectionHeading>
        <Card>
          <Field label="Change password">
            <div className="flex flex-col gap-2">
              <input
                type="password"
                autoComplete="current-password"
                placeholder="Current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="focus-accent rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2 text-sm outline-none"
              />
              <input
                type="password"
                autoComplete="new-password"
                placeholder="New password (min. 8 characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="focus-accent rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2 text-sm outline-none"
              />
              <button
                onClick={changePassword}
                disabled={
                  busy === "password" ||
                  !currentPassword ||
                  newPassword.length < 8
                }
                className="bg-accent self-start rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {busy === "password" ? "Changing…" : "Change password"}
              </button>
            </div>
          </Field>
        </Card>

        {/* ---------------- Storage ---------------- */}
        <SectionHeading icon={Database}>Storage</SectionHeading>
        <Card>
          {storage ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Stat label="Conversations" value={storage.conversations} />
              <Stat label="Messages" value={storage.messages} />
              <Stat label="Projects" value={storage.projects} />
              <Stat label="Memories" value={storage.memoryEntries} />
              <Stat label="Files" value={storage.assets} />
              <Stat label="Size" value={formatBytes(storage.totalBytes)} />
            </div>
          ) : (
            <div className="h-16 animate-pulse rounded-lg bg-black/5 dark:bg-white/5" />
          )}
        </Card>

        {/* ---------------- Data controls ---------------- */}
        <SectionHeading icon={Shield}>Data controls</SectionHeading>
        <Card>
          <div className="flex flex-col gap-2">
            <button
              onClick={exportData}
              disabled={busy === "export"}
              className="flex items-center gap-2 self-start rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
            >
              <Download size={14} />
              {busy === "export" ? "Preparing…" : "Export all my data"}
            </button>
            <Hint>
              Downloads every conversation, project, memory entry and file as one
              JSON file.
            </Hint>
          </div>

          <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
            <button
              onClick={eraseData}
              disabled={busy === "erase"}
              className="flex items-center gap-2 rounded-lg border border-hetex-red-500/40 px-3 py-2 text-sm text-hetex-red-500 hover:bg-hetex-red-500/10 disabled:opacity-50"
            >
              <Trash2 size={14} />
              {busy === "erase" ? "Deleting…" : "Delete all my data"}
            </button>
            <Hint>Keeps your account. Everything in it is removed.</Hint>
          </div>

          <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
            <Field label="Delete account permanently">
              <div className="flex flex-col gap-2">
                <input
                  type="password"
                  autoComplete="current-password"
                  placeholder="Confirm your password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="focus-accent rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2 text-sm outline-none"
                />
                <button
                  onClick={deleteAccount}
                  disabled={busy === "delete-account" || !deletePassword}
                  className="self-start rounded-lg bg-hetex-red-500 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {busy === "delete-account" ? "Deleting…" : "Delete my account"}
                </button>
              </div>
            </Field>
          </div>
        </Card>

        {/* ---------------- Keyboard ---------------- */}
        <SectionHeading icon={Keyboard}>Keyboard</SectionHeading>
        <Card>
          <div className="flex flex-col gap-2">
            {SHORTCUTS.map((s) => (
              <div
                key={s.keys}
                className="flex items-center justify-between gap-4 text-sm"
              >
                <span className="text-[var(--text-secondary)]">{s.action}</span>
                <kbd className="shrink-0 rounded border border-[var(--border-subtle)] bg-black/[0.03] px-2 py-0.5 font-mono text-xs dark:bg-white/[0.05]">
                  {s.keys}
                </kbd>
              </div>
            ))}
          </div>
        </Card>

        {/* ---------------- Usage ---------------- */}
        <SectionHeading icon={Sparkles}>Usage</SectionHeading>
        <Card>
          <Row label="Plan">
            <span className="bg-accent-soft rounded-full px-2.5 py-0.5 text-xs font-medium">
              {usage.plan}
            </span>
          </Row>
          <Row label="Messages sent">
            <span className="text-sm">{usage.totals.message ?? 0}</span>
          </Row>
        </Card>

        {/* ---------------- Legal ---------------- */}
        <SectionHeading icon={Shield}>Legal</SectionHeading>
        <Card>
          <Link href="/terms" className="text-accent text-sm hover:underline">
            Terms &amp; Conditions
          </Link>
        </Card>

        {(notice || combinedError) && (
          <div
            role="status"
            className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg px-4 py-2 text-sm shadow-lg ${
              combinedError
                ? "border border-hetex-red-500/30 bg-hetex-red-500 text-white"
                : "bg-accent text-white"
            }`}
          >
            {combinedError ?? notice}
          </div>
        )}
      </div>
    </div>
  );
}

function SectionHeading({
  children,
  icon: Icon,
}: {
  children: React.ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <h2 className="mb-2 mt-8 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">
      {Icon && <Icon size={12} />}
      {children}
    </h2>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] p-4">
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <span className="text-sm">{label}</span>
      {children}
    </div>
  );
}

function Field({
  label,
  children,
  icon: Icon,
}: {
  label: string;
  children: React.ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div>
      <label className="mb-1 flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
        {Icon && <Icon size={13} />}
        {label}
      </label>
      {children}
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1.5 text-xs text-[var(--text-secondary)]">{children}</p>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg bg-black/[0.03] px-3 py-2 dark:bg-white/[0.05]">
      <p className="text-lg font-semibold">{value}</p>
      <p className="text-xs text-[var(--text-secondary)]">{label}</p>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
        checked ? "bg-accent" : "bg-black/15 dark:bg-white/15"
      }`}
      role="switch"
      aria-checked={checked}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
