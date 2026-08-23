"use client";

import { useEffect, useState } from "react";
import { Palette, Type, Languages, Sparkles, Info } from "lucide-react";
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

type Meta = {
  models: { value: string; label: string; description: string }[];
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

  const higherIntelligence = prefs.model === "claude-opus-5";
  const opus = meta?.models.find((m) => m.value === "claude-opus-5");

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

      <SettingsRow
        label="Higher intelligence"
        icon={Sparkles}
        description={
          opus?.description ??
          "Uses a stronger, more expensive model for every message."
        }
      >
        <SettingsToggle
          label="Higher intelligence"
          checked={higherIntelligence}
          onChange={(v) =>
            save({ model: v ? "claude-opus-5" : "claude-sonnet-4-6" })
          }
        />
      </SettingsRow>

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
