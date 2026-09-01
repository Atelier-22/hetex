"use client";

import { useEffect, useState } from "react";
import {
  SaveIndicator,
  SectionHeader,
  SettingsBlock,
  SettingsButton,
  SettingsCard,
  SettingsDropdown,
  SettingsRow,
  SettingsToggle,
  StatusPill,
} from "../primitives";
import { useSection } from "../use-section";

const MAX_INSTRUCTIONS = 4000;

export function ProjectsSection() {
  const { values, set, reset, resetting, saveState, error, meta } =
    useSection("projects");

  const [instructions, setInstructions] = useState(
    values.defaultInstructions ?? ""
  );

  useEffect(() => {
    setInstructions(values.defaultInstructions ?? "");
  }, [values.defaultInstructions]);

  const dirty = instructions !== (values.defaultInstructions ?? "");
  const models = meta?.models ?? [];
  const projectsDisabled = meta?.features?.projects === false;

  return (
    <>
      <SectionHeader
        title="Projects"
        description="Defaults applied to every project, and what a project contributes to a conversation."
        onReset={reset}
        resetting={resetting}
      />

      <div className="mb-3 flex justify-end">
        <SaveIndicator state={saveState} error={error} />
      </div>

      <SettingsCard title="Behaviour">
        <SettingsRow
          label="Use project instructions"
          description="A conversation inside a project has that project's instructions added to the system prompt. Off means the project is only a folder."
          unavailable={
            projectsDisabled
              ? "An administrator has turned projects off for this server."
              : undefined
          }
        >
          <SettingsToggle
            label="Use project instructions"
            checked={values.useProjectContext}
            onChange={(v) => set({ useProjectContext: v })}
            disabled={projectsDisabled}
          />
        </SettingsRow>

        <SettingsRow
          label="Save project work automatically"
          description="Conversations started inside a project stay attached to it."
        >
          <SettingsToggle
            label="Save project work automatically"
            checked={values.autoSave}
            onChange={(v) => set({ autoSave: v })}
            disabled={projectsDisabled}
          />
        </SettingsRow>

        <SettingsRow
          label="Project memory"
          description="Lets Aviel record what a project is about, filed under the Projects memory category. Needs Memory switched on."
          unavailable={
            meta?.features?.memory === false
              ? "Memory is turned off for this server."
              : undefined
          }
        >
          <SettingsToggle
            label="Project memory"
            checked={values.projectMemory}
            onChange={(v) => set({ projectMemory: v })}
            disabled={projectsDisabled || meta?.features?.memory === false}
          />
        </SettingsRow>

        <SettingsRow
          label="Index project files"
          unavailable="File indexing needs document text extraction and an embedding store, neither of which exists on this server. The preference is stored for when they do."
        >
          <div className="flex items-center gap-2">
            <StatusPill tone="off">Not built</StatusPill>
            <SettingsToggle
              label="Index project files"
              checked={values.fileIndexing}
              onChange={(v) => set({ fileIndexing: v })}
              disabled
            />
          </div>
        </SettingsRow>

        <SettingsRow
          label="Project notifications"
          unavailable="No delivery channel exists yet. The preference is stored and honoured by the permission check every future sender has to pass."
        >
          <SettingsToggle
            label="Project notifications"
            checked={values.notifications}
            onChange={(v) => set({ notifications: v })}
          />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard
        title="Defaults for new projects"
        description="Applied when a project does not set its own."
      >
        <SettingsRow label="Default model">
          <SettingsDropdown
            label="Default model"
            value={values.defaultModel ?? ""}
            onChange={(v) => set({ defaultModel: v || null })}
            options={[
              { value: "", label: "Use my default model" },
              ...models.map((m) => ({ value: m.value, label: m.label })),
            ]}
          />
        </SettingsRow>

        <SettingsRow
          label="Default response style"
          description="Overrides your personality setting inside projects."
        >
          <SettingsDropdown
            label="Default response style"
            value={values.defaultResponseStyle}
            onChange={(v) => set({ defaultResponseStyle: v })}
            options={[
              { value: "inherit", label: "Use my setting" },
              { value: "concise", label: "Concise" },
              { value: "balanced", label: "Balanced" },
              { value: "detailed", label: "Detailed" },
              { value: "very_detailed", label: "Very detailed" },
            ]}
          />
        </SettingsRow>

        <SettingsBlock
          label="Default instructions"
          description="Pre-filled into a new project. Existing projects keep their own."
        >
          <textarea
            value={instructions}
            aria-label="Default project instructions"
            onChange={(e) =>
              setInstructions(e.target.value.slice(0, MAX_INSTRUCTIONS))
            }
            onBlur={() =>
              dirty && set({ defaultInstructions: instructions.trim() || null })
            }
            rows={4}
            placeholder="e.g. This project is a Next.js app. Prefer TypeScript and show whole files."
            className="focus-ring w-full resize-y rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2.5 text-sm leading-relaxed outline-none"
          />
          <div className="mt-2.5 flex items-center justify-between gap-3">
            <span className="text-xs tabular-nums text-[var(--text-secondary)]">
              {instructions.length} / {MAX_INSTRUCTIONS}
            </span>
            <SettingsButton
              variant="primary"
              disabled={!dirty}
              busy={saveState === "saving"}
              onClick={() =>
                set({ defaultInstructions: instructions.trim() || null })
              }
            >
              Save
            </SettingsButton>
          </div>
        </SettingsBlock>
      </SettingsCard>
    </>
  );
}
