"use client";

import { useCallback, useEffect, useState } from "react";
import { Brain, Check, Pencil, Trash2, X } from "lucide-react";
import {
  Callout,
  ConfirmButton,
  LoadingRows,
  SaveIndicator,
  SectionHeader,
  SettingsBlock,
  SettingsButton,
  SettingsCard,
  SettingsDropdown,
  SettingsRow,
  SettingsSlider,
  SettingsToggle,
  StatusPill,
} from "../primitives";
import { useSection } from "../use-section";
import { apiFetch } from "@/lib/api-client";
import type { MemoryCategory } from "@/lib/settings/types";

type Entry = {
  id: string;
  content: string;
  category: MemoryCategory;
  source: "manual" | "inferred";
  createdAt: string;
};

type MemoryResponse = {
  entries: Entry[];
  enabled: boolean;
  categories: { id: MemoryCategory; active: boolean; count: number }[];
};

const CATEGORY_LABELS: Record<MemoryCategory, string> = {
  preferences: "Preferences",
  projects: "Projects",
  personalization: "About you",
  conversation: "Conversation context",
};

const CATEGORY_SETTING = {
  preferences: "rememberPreferences",
  projects: "rememberProjects",
  personalization: "rememberPersonal",
  conversation: "rememberConversationContext",
} as const;

export function MemorySection() {
  const { values, set, reset, resetting, saveState, error, meta } =
    useSection("memory");

  const [data, setData] = useState<MemoryResponse | null>(null);
  const [draft, setDraft] = useState("");
  const [draftCategory, setDraftCategory] = useState<MemoryCategory>("preferences");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [memoryError, setMemoryError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    apiFetch<MemoryResponse>("/memory")
      .then(setData)
      .catch(() =>
        setData({ entries: [], enabled: false, categories: [] })
      );
  }, []);

  useEffect(load, [load]);

  const memoryDisabledByAdmin = meta?.features?.memory === false;
  const cap = meta?.limits?.maxMemoryEntries ?? 60;

  async function addEntry() {
    const content = draft.trim();
    if (!content) return;

    setBusy(true);
    setMemoryError(null);
    try {
      await apiFetch<Entry>("/memory", {
        method: "POST",
        body: JSON.stringify({ content, category: draftCategory }),
      });
      setDraft("");
      load();
    } catch (err) {
      setMemoryError(err instanceof Error ? err.message : "Couldn't save that.");
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(id: string) {
    const content = editText.trim();
    if (!content) return;

    setMemoryError(null);
    try {
      await apiFetch(`/memory/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ content }),
      });
      setEditingId(null);
      load();
    } catch (err) {
      setMemoryError(err instanceof Error ? err.message : "Couldn't save that.");
    }
  }

  async function removeEntry(id: string) {
    const previous = data;
    setData((d) =>
      d ? { ...d, entries: d.entries.filter((e) => e.id !== id) } : d
    );
    try {
      await apiFetch(`/memory/${id}`, { method: "DELETE" });
      load();
    } catch (err) {
      setData(previous);
      setMemoryError(err instanceof Error ? err.message : "Couldn't delete that.");
    }
  }

  async function clearAll(category?: MemoryCategory) {
    setBusy(true);
    setMemoryError(null);
    try {
      await apiFetch("/memory/clear", {
        method: "POST",
        body: JSON.stringify(category ? { category } : {}),
      });
      load();
    } catch (err) {
      setMemoryError(err instanceof Error ? err.message : "Couldn't delete those.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SectionHeader
        title="Memory"
        description="What Hetex carries between conversations. Nothing is remembered while this is off, and nothing is recalled from a category you have switched off."
        onReset={reset}
        resetting={resetting}
      />

      <div className="mb-3 flex justify-end">
        <SaveIndicator state={saveState} error={error} />
      </div>

      {memoryDisabledByAdmin && (
        <Callout tone="warn" title="Memory is unavailable">
          An administrator has turned memory off for this server. Your stored
          entries are untouched, but nothing is written or recalled.
        </Callout>
      )}

      <SettingsCard title="Memory">
        <SettingsRow
          label="Remember things between conversations"
          icon={Brain}
          description="When off, memories are neither written nor read. Existing entries stay saved and are used again if you switch it back on."
        >
          <SettingsToggle
            label="Remember things between conversations"
            checked={values.enabled}
            onChange={(v) => set({ enabled: v })}
            disabled={memoryDisabledByAdmin}
          />
        </SettingsRow>

        <SettingsRow
          label="Add to memory automatically"
          description="Off means Hetex only remembers what you add here by hand. It never infers anything on its own."
        >
          <SettingsToggle
            label="Add to memory automatically"
            checked={values.autoCapture}
            onChange={(v) => set({ autoCapture: v })}
            disabled={!values.enabled || memoryDisabledByAdmin}
          />
        </SettingsRow>

        <SettingsRow
          label="How much is recalled"
          description={`At most this many entries are included in the prompt, newest first. This server allows up to ${cap}.`}
        >
          <SettingsSlider
            label="Entries recalled per message"
            value={values.maxEntriesInPrompt}
            min={1}
            max={Math.min(60, cap)}
            step={1}
            disabled={!values.enabled}
            onCommit={(v) => set({ maxEntriesInPrompt: v })}
            format={(v) => `${v}`}
          />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard
        title="What may be remembered"
        description="A category that is off is never written and never recalled — the filter is applied when memories are saved, not only when they are read."
      >
        {(Object.keys(CATEGORY_LABELS) as MemoryCategory[]).map((category) => {
          const key = CATEGORY_SETTING[category];
          const count =
            data?.categories.find((c) => c.id === category)?.count ?? 0;
          return (
            <SettingsRow
              key={category}
              label={CATEGORY_LABELS[category]}
              description={`${count} stored`}
            >
              <SettingsToggle
                label={CATEGORY_LABELS[category]}
                checked={values[key]}
                onChange={(v) => set({ [key]: v } as never)}
                disabled={!values.enabled || memoryDisabledByAdmin}
              />
            </SettingsRow>
          );
        })}
      </SettingsCard>

      <SettingsCard
        title="Saved memories"
        description="Everything Hetex has stored about you. Edit or delete any of it."
      >
        <SettingsBlock>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={draft}
              aria-label="New memory"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addEntry()}
              placeholder="e.g. I prefer concise code explanations"
              maxLength={500}
              className="focus-ring flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2 text-sm outline-none"
            />
            <SettingsDropdown
              label="Category"
              value={draftCategory}
              onChange={(v) => setDraftCategory(v as MemoryCategory)}
              options={(Object.keys(CATEGORY_LABELS) as MemoryCategory[]).map(
                (c) => ({ value: c, label: CATEGORY_LABELS[c] })
              )}
            />
            <SettingsButton variant="primary" onClick={addEntry} busy={busy}>
              Add
            </SettingsButton>
          </div>

          {memoryError && (
            <p role="alert" className="mt-2 text-xs text-hetex-red-500">
              {memoryError}
            </p>
          )}
        </SettingsBlock>

        <SettingsBlock>
          {!data && <LoadingRows count={3} />}

          {data && data.entries.length === 0 && (
            <p className="text-xs text-[var(--text-secondary)]">
              Nothing saved yet.
            </p>
          )}

          <div className="flex flex-col gap-2">
            {data?.entries.map((entry) => {
              const categoryActive =
                data.categories.find((c) => c.id === entry.category)?.active ??
                false;

              return (
                <div
                  key={entry.id}
                  className="rounded-lg border border-[var(--border-subtle)] px-3 py-2.5"
                >
                  {editingId === entry.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        value={editText}
                        aria-label="Edit memory"
                        autoFocus
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit(entry.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        maxLength={500}
                        className="focus-ring min-w-0 flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2.5 py-1.5 text-sm outline-none"
                      />
                      <button
                        onClick={() => saveEdit(entry.id)}
                        aria-label="Save memory"
                        className="focus-ring rounded p-1.5 text-accent"
                      >
                        <Check size={15} />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        aria-label="Cancel editing"
                        className="focus-ring rounded p-1.5 text-[var(--text-secondary)]"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words text-sm">{entry.content}</p>
                        <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <StatusPill>{CATEGORY_LABELS[entry.category]}</StatusPill>
                          <StatusPill>
                            {entry.source === "manual" ? "Added by you" : "Learned"}
                          </StatusPill>
                          {!categoryActive && (
                            <StatusPill tone="warn">Not in use</StatusPill>
                          )}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-0.5">
                        <button
                          onClick={() => {
                            setEditingId(entry.id);
                            setEditText(entry.content);
                          }}
                          aria-label={`Edit memory: ${entry.content}`}
                          className="focus-ring rounded p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => removeEntry(entry.id)}
                          aria-label={`Delete memory: ${entry.content}`}
                          className="focus-ring rounded p-1.5 text-[var(--text-secondary)] hover:text-hetex-red-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </SettingsBlock>

        <SettingsRow
          label="Delete all memories"
          description="Removes every stored entry. Your conversations, files and projects are untouched."
        >
          <ConfirmButton
            question="Delete every saved memory? This cannot be undone."
            confirmLabel="Delete all"
            busy={busy}
            disabled={!data || data.entries.length === 0}
            onConfirm={() => clearAll()}
          >
            <Trash2 size={13} /> Delete all
          </ConfirmButton>
        </SettingsRow>
      </SettingsCard>

      <Callout title="Excluding one conversation">
        A single conversation can be kept out of memory entirely from the chat
        header — nothing from it is written, however these settings are set.
      </Callout>
    </>
  );
}
