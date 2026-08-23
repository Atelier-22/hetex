"use client";

import { useEffect, useState } from "react";
import { Trash2, Brain } from "lucide-react";
import {
  SectionHeader,
  SettingsRow,
  SettingsBlock,
  SettingsToggle,
  SettingsDropdown,
  SettingsButton,
  SaveIndicator,
} from "../primitives";
import { usePreferences } from "../../preferences";
import { useSave } from "../use-save";
import { apiFetch } from "@/lib/api-client";

type MemoryEntry = { id: string; content: string; createdAt: string };

const MAX_INSTRUCTIONS = 4000;

export function PersonalizationSection() {
  const { prefs, update } = usePreferences();
  const { state, error, run } = useSave();

  const [instructions, setInstructions] = useState(prefs.customInstructions ?? "");
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [newMemory, setNewMemory] = useState("");
  const [memoryError, setMemoryError] = useState<string | null>(null);

  useEffect(() => {
    setInstructions(prefs.customInstructions ?? "");
  }, [prefs.customInstructions]);

  useEffect(() => {
    apiFetch<MemoryEntry[]>("/memory").then(setMemories).catch(() => {});
  }, []);

  const dirty = instructions !== (prefs.customInstructions ?? "");

  function saveInstructions() {
    if (!dirty) return;
    run(() => update({ customInstructions: instructions.trim() || null }));
  }

  async function addMemory() {
    const content = newMemory.trim();
    if (!content) return;
    setMemoryError(null);
    try {
      const entry = await apiFetch<MemoryEntry>("/memory", {
        method: "POST",
        body: JSON.stringify({ content }),
      });
      setMemories((prev) => [entry, ...prev]);
      setNewMemory("");
    } catch (err) {
      setMemoryError(err instanceof Error ? err.message : "Could not save that");
    }
  }

  async function deleteMemory(id: string) {
    const previous = memories;
    setMemories((prev) => prev.filter((m) => m.id !== id));
    try {
      await apiFetch(`/memory/${id}`, { method: "DELETE" });
    } catch {
      setMemories(previous);
    }
  }

  return (
    <>
      <SectionHeader
        title="Personalization"
        description="How Hetex talks to you, and what it remembers."
      />

      <div className="flex justify-end pb-1">
        <SaveIndicator state={state} />
      </div>

      <SettingsBlock
        label="Custom instructions"
        description="Added to the system prompt on every conversation, new and existing. Say how you want Hetex to respond, or anything it should always know about you."
      >
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value.slice(0, MAX_INSTRUCTIONS))}
          onBlur={saveInstructions}
          rows={5}
          placeholder="e.g. I'm a developer working mostly in TypeScript. Skip the preamble and show me code."
          className="focus-accent w-full resize-y rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2.5 text-sm outline-none"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-[var(--text-secondary)]">
            {instructions.length} / {MAX_INSTRUCTIONS}
          </span>
          <SettingsButton
            variant="primary"
            onClick={saveInstructions}
            disabled={!dirty}
            busy={state === "saving"}
          >
            Save instructions
          </SettingsButton>
        </div>
      </SettingsBlock>

      <SettingsRow label="Assistant name">
        <input
          value={prefs.assistantName}
          onChange={(e) => run(() => update({ assistantName: e.target.value }))}
          className="focus-accent w-40 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2.5 py-1.5 text-sm outline-none"
        />
      </SettingsRow>

      <SettingsRow label="Response style">
        <SettingsDropdown
          label="Response style"
          value={prefs.responseStyle}
          onChange={(v) => run(() => update({ responseStyle: v }))}
          options={[
            { value: "concise", label: "Concise" },
            { value: "balanced", label: "Balanced" },
            { value: "detailed", label: "Detailed" },
          ]}
        />
      </SettingsRow>

      <SettingsRow
        label="Memory"
        icon={Brain}
        description="When on, the entries below are included in the system prompt. Hetex does not add to this on its own — you decide what it remembers."
      >
        <SettingsToggle
          label="Memory"
          checked={prefs.memoryEnabled}
          onChange={(v) => run(() => update({ memoryEnabled: v }))}
        />
      </SettingsRow>

      {prefs.memoryEnabled && (
        <div className="py-4">
          <div className="flex gap-2">
            <input
              value={newMemory}
              onChange={(e) => setNewMemory(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addMemory()}
              placeholder="e.g. I prefer concise code explanations"
              className="focus-accent flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2 text-sm outline-none"
            />
            <SettingsButton variant="primary" onClick={addMemory}>
              Add
            </SettingsButton>
          </div>

          {memoryError && (
            <p className="mt-2 text-xs text-hetex-red-500">{memoryError}</p>
          )}

          <div className="mt-3 flex flex-col gap-1.5">
            {memories.length === 0 && (
              <p className="text-xs text-[var(--text-secondary)]">
                Nothing saved yet.
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

      {error && <p className="mt-4 text-xs text-hetex-red-500">{error}</p>}
    </>
  );
}
