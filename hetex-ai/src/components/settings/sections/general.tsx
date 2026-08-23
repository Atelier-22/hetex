"use client";

import { useEffect, useState } from "react";
import { Palette, Type, Languages, Info } from "lucide-react";
import {
  SectionHeader,
  SettingsRow,
  SettingsBlock,
  SettingsToggle,
  SettingsDropdown,
  SettingsStepper,
  SaveIndicator,
  NotWiredBadge,
} from "../primitives";
import { ThemeToggle } from "../../theme-toggle";
import { usePreferences } from "../../preferences";
import { useSave } from "../use-save";
import { apiFetch } from "@/lib/api-client";
import { APP_VERSION } from "@/lib/version";

const ACCENTS = [
  { value: "green", label: "Green", swatch: "#14b366" },
  { value: "blue", label: "Blue", swatch: "#3178f5" },
  { value: "violet", label: "Violet", swatch: "#7c5cf0" },
  { value: "amber", label: "Amber", swatch: "#d98c05" },
  { value: "rose", label: "Rose", swatch: "#e0245e" },
];

const TEXT_SIZES = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
];

type Model = {
  value: string;
  label: string;
  description: string;
  capabilities: { webSearch: boolean; images: boolean };
};

type Meta = {
  models: Model[];
  languages: { value: string; label: string }[];
};

export function GeneralSection() {
  const { prefs, update } = usePreferences();
  const { state, error, run } = useSave();
  const [meta, setMeta] = useState<Meta | null>(null);

  useEffect(() => {
    apiFetch<Meta>("/settings/meta").then(setMeta).catch(() => {});
  }, []);

  const save = (patch: Parameters<typeof update>[0]) => run(() => update(patch));


  return (
    <>
      <SectionHeader
        title="General"
        description="How Hetex looks and which model answers you."
      />

      <div className="flex justify-end pb-1">
        <SaveIndicator state={state} />
      </div>

      <SettingsRow label="Theme" icon={Palette}>
        <ThemeToggle />
      </SettingsRow>

      <SettingsBlock label="Accent colour">
        <div className="flex flex-wrap gap-2">
          {ACCENTS.map((a) => (
            <button
              key={a.value}
              onClick={() => save({ accentColor: a.value })}
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
      </SettingsBlock>

      <SettingsRow label="Text size" icon={Type}>
        <SettingsStepper
          label="text size"
          value={prefs.textSize}
          options={TEXT_SIZES}
          defaultValue="medium"
          onChange={(v) => save({ textSize: v })}
        />
      </SettingsRow>

      <SettingsRow
        label="Language"
        icon={Languages}
        description={
          <span className="flex items-center gap-2">
            <NotWiredBadge>Stored only</NotWiredBadge>
            Hetex is English-only for now. Your choice is saved and applies when
            translations land.
          </span>
        }
      >
        <SettingsDropdown
          label="Language"
          value={prefs.language}
          onChange={(v) => save({ language: v })}
          options={
            meta?.languages ?? [{ value: "auto", label: "Auto-detect" }]
          }
        />
      </SettingsRow>

      <SettingsBlock
        label="Model"
        description="Which model answers you. Each is better at different things — the trade-offs are stated, not hidden behind a single quality dial."
      >
        <div className="flex flex-col gap-2">
          {(meta?.models ?? []).map((m) => {
            const selected = prefs.model === m.value;
            return (
              <button
                key={m.value}
                onClick={() => save({ model: m.value })}
                aria-pressed={selected}
                className={`rounded-xl border px-3.5 py-3 text-left transition-colors ${
                  selected
                    ? "border-accent bg-accent-soft"
                    : "border-[var(--border-subtle)] hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"
                }`}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">{m.label}</span>
                  {selected && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide">
                      In use
                    </span>
                  )}
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-[var(--text-secondary)]">
                  {m.description}
                </span>
                <span className="mt-2 flex flex-wrap gap-1.5">
                  <Capability on={m.capabilities.webSearch} label="Web search" />
                  <Capability on={m.capabilities.images} label="Reads images" />
                </span>
              </button>
            );
          })}

          {meta && meta.models.length === 0 && (
            <p className="text-xs text-[var(--text-secondary)]">
              No models are configured on the server.
            </p>
          )}
          {!meta && (
            <div className="h-24 animate-pulse rounded-xl bg-black/5 dark:bg-white/5" />
          )}
        </div>
      </SettingsBlock>

      <SettingsRow
        label="Launch at login"
        description={
          <span className="flex items-center gap-2">
            <NotWiredBadge>Desktop only</NotWiredBadge>
            Has no effect in a browser. Saved so a future desktop build inherits
            it.
          </span>
        }
      >
        <SettingsToggle
          label="Launch at login"
          checked={prefs.launchAtLogin}
          onChange={(v) => save({ launchAtLogin: v })}
        />
      </SettingsRow>

      <SettingsRow
        label="App updates"
        icon={Info}
        description="Hetex on the web updates itself — there is nothing to install."
      >
        <span className="font-mono text-xs text-[var(--text-secondary)]">
          v{APP_VERSION}
        </span>
      </SettingsRow>

      {error && (
        <p className="mt-4 text-xs text-hetex-red-500">{error}</p>
      )}
    </>
  );
}

/** A capability the selected model either has or does not. */
function Capability({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
        on
          ? "border-[var(--border-subtle)] text-[var(--text-secondary)]"
          : "border-transparent bg-black/[0.04] text-[var(--text-secondary)] line-through opacity-70 dark:bg-white/[0.06]"
      }`}
    >
      {label}
    </span>
  );
}
