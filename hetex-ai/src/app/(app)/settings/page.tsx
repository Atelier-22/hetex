"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

type Settings = {
  assistantName: string;
  responseStyle: string;
  memoryEnabled: boolean;
  enterToSend: boolean;
};

type MemoryEntry = { id: string; content: string; createdAt: string };

export default function SettingsPage() {
  const { data: session } = useSession();
  const [settings, setSettings] = useState<Settings>({
    assistantName: "Hetex AI",
    responseStyle: "balanced",
    memoryEnabled: false,
    enterToSend: true,
  });
  const [saved, setSaved] = useState(false);
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [newMemory, setNewMemory] = useState("");
  const [usage, setUsage] = useState<{ totals: Record<string, number>; plan: string }>({
    totals: {},
    plan: "Free",
  });

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) =>
        setSettings({
          assistantName: data.assistantName,
          responseStyle: data.responseStyle,
          memoryEnabled: Boolean(data.memoryEnabled),
          enterToSend: data.enterToSend ?? true,
        })
      );
    fetch("/api/memory")
      .then((r) => r.json())
      .then(setMemories);
    fetch("/api/usage")
      .then((r) => r.json())
      .then(setUsage);
  }, []);

  async function save(patch: Partial<Settings> = {}) {
    const next = { ...settings, ...patch };
    setSettings(next);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  async function addMemory() {
    if (!newMemory.trim()) return;
    const res = await fetch("/api/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: newMemory }),
    });
    const entry = await res.json();
    setMemories((prev) => [entry, ...prev]);
    setNewMemory("");
  }

  async function deleteMemory(id: string) {
    await fetch("/api/memory", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setMemories((prev) => prev.filter((m) => m.id !== id));
  }

  return (
    <div className="h-full overflow-y-auto px-6 py-10 md:px-12">
      <div className="mx-auto max-w-2xl pb-16">
        <h1 className="text-2xl font-semibold">Settings</h1>

        {/* Account */}
        <SectionHeading>Account</SectionHeading>
        <Card>
          <Row label="Email">
            <span className="text-sm">{session?.user?.email}</span>
          </Row>
          <Row label="Password">
            <span className="text-xs text-[var(--text-secondary)]">
              Password changes aren't available yet — coming in a future update.
            </span>
          </Row>
        </Card>

        {/* Appearance */}
        <SectionHeading>Appearance</SectionHeading>
        <Card>
          <Row label="Theme">
            <ThemeToggle />
          </Row>
        </Card>

        {/* AI Preferences */}
        <SectionHeading>AI Preferences</SectionHeading>
        <Card>
          <div>
            <label className="text-sm text-[var(--text-secondary)]">Assistant name</label>
            <input
              value={settings.assistantName}
              onChange={(e) => setSettings((s) => ({ ...s, assistantName: e.target.value }))}
              onBlur={() => save()}
              className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2 text-sm outline-none focus:border-hetex-green-500"
            />
          </div>
          <div className="mt-4">
            <label className="text-sm text-[var(--text-secondary)]">Response style</label>
            <select
              value={settings.responseStyle}
              onChange={(e) => save({ responseStyle: e.target.value })}
              className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2 text-sm outline-none focus:border-hetex-green-500"
            >
              <option value="concise">Concise</option>
              <option value="balanced">Balanced</option>
              <option value="detailed">Detailed</option>
            </select>
          </div>
        </Card>

        {/* Voice */}
        <SectionHeading>Voice</SectionHeading>
        <Card>
          <p className="text-xs text-[var(--text-secondary)]">
            Read Aloud uses your browser's built-in speech synthesis — available
            on the actions bar under any assistant response. Voice selection
            and a dedicated provider are planned for a future update.
          </p>
        </Card>

        {/* Chat */}
        <SectionHeading>Chat</SectionHeading>
        <Card>
          <Row label="Send message with Enter">
            <Toggle
              checked={settings.enterToSend}
              onChange={(v) => save({ enterToSend: v })}
            />
          </Row>
        </Card>

        {/* Memory */}
        <SectionHeading>Memory</SectionHeading>
        <Card>
          <Row label="Let Hetex AI remember things about you across chats">
            <Toggle
              checked={settings.memoryEnabled}
              onChange={(v) => save({ memoryEnabled: v })}
            />
          </Row>
          {settings.memoryEnabled && (
            <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
              <div className="flex gap-2">
                <input
                  value={newMemory}
                  onChange={(e) => setNewMemory(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addMemory()}
                  placeholder="e.g. I prefer concise code explanations"
                  className="flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2 text-sm outline-none focus:border-hetex-green-500"
                />
                <button
                  onClick={addMemory}
                  className="rounded-lg bg-hetex-green-500 px-3 py-2 text-sm font-medium text-white"
                >
                  Add
                </button>
              </div>
              <div className="mt-3 flex flex-col gap-1.5">
                {memories.length === 0 && (
                  <p className="text-xs text-[var(--text-secondary)]">
                    Nothing saved yet. Memory isn't created automatically from
                    conversations — add what you want remembered here.
                  </p>
                )}
                {memories.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between rounded-lg bg-black/[0.03] px-3 py-1.5 text-sm dark:bg-white/[0.05]"
                  >
                    <span>{m.content}</span>
                    <button
                      onClick={() => deleteMemory(m.id)}
                      className="text-[var(--text-secondary)] hover:text-hetex-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Privacy */}
        <SectionHeading>Privacy</SectionHeading>
        <Card>
          <p className="text-xs text-[var(--text-secondary)]">
            Conversations are stored so you can revisit them. Delete any chat
            individually from the sidebar. Memory entries above can be
            removed at any time. A full "delete all my data" control is
            planned for a future update.
          </p>
        </Card>

        {/* Usage */}
        <SectionHeading>Usage</SectionHeading>
        <Card>
          <Row label="Plan">
            <span className="rounded-full bg-hetex-green-100 px-2.5 py-0.5 text-xs font-medium text-hetex-green-800 dark:bg-white/10 dark:text-white">
              {usage.plan}
            </span>
          </Row>
          <Row label="Messages sent">
            <span className="text-sm">{usage.totals.message ?? 0}</span>
          </Row>
        </Card>

        {/* Legal */}
        <SectionHeading>Legal</SectionHeading>
        <Card>
          <Link
            href="/terms"
            className="text-sm text-hetex-green-600 hover:underline dark:text-hetex-green-400"
          >
            Terms & Conditions
          </Link>
        </Card>

        {saved && (
          <p className="mt-6 text-center text-xs text-hetex-green-600 dark:text-hetex-green-400">
            Saved
          </p>
        )}
      </div>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-8 mb-2 text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">
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
        checked ? "bg-hetex-green-500" : "bg-black/15 dark:bg-white/15"
      }`}
      aria-pressed={checked}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
