"use client";

import { Monitor, Moon, Sun, Zap } from "lucide-react";
import {
  Callout,
  OptionCards,
  SaveIndicator,
  SectionHeader,
  SegmentedControl,
  SettingsBlock,
  SettingsCard,
  SettingsRow,
} from "../primitives";
import { useSection } from "../use-section";

const ACCENTS = [
  { value: "green" as const, label: "Green", swatch: "#14b366" },
  { value: "blue" as const, label: "Blue", swatch: "#3178f5" },
  { value: "violet" as const, label: "Violet", swatch: "#7c5cf0" },
  { value: "amber" as const, label: "Amber", swatch: "#d98c05" },
  { value: "rose" as const, label: "Rose", swatch: "#e0245e" },
];

const THEMES = [
  { value: "light" as const, label: "Light", icon: Sun },
  { value: "dark" as const, label: "Dark", icon: Moon },
  { value: "system" as const, label: "System", icon: Monitor },
  { value: "amoled" as const, label: "AMOLED", icon: Zap },
];

export function AppearanceSection() {
  const { values, set, reset, resetting, saveState, error, settings } =
    useSection("appearance");

  const acc = settings.accessibility;
  const textOverridden = acc.largeText || acc.extraLargeText;
  const motionOverridden = acc.reduceMotion;

  return (
    <>
      <SectionHeader
        title="Appearance"
        description="Everything here applies the moment you change it, across the whole interface."
        onReset={reset}
        resetting={resetting}
      />

      <div className="mb-3 flex justify-end">
        <SaveIndicator state={saveState} error={error} />
      </div>

      <SettingsCard title="Theme">
        <SettingsBlock>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {THEMES.map((t) => {
              const Icon = t.icon;
              const active = values.theme === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={t.label}
                  onClick={() => set({ theme: t.value })}
                  className={`focus-ring flex flex-col items-center gap-2 rounded-xl border px-3 py-3.5 text-xs font-medium transition-colors ${
                    active
                      ? "border-accent bg-accent-soft"
                      : "border-[var(--border-subtle)] hover:bg-[var(--surface-hover)]"
                  }`}
                >
                  <Icon size={18} />
                  {t.label}
                </button>
              );
            })}
          </div>
          <p className="mt-2.5 text-xs leading-relaxed text-[var(--text-secondary)]">
            AMOLED is the dark theme with true black backgrounds, which saves
            power on an OLED screen. System follows your device.
          </p>
        </SettingsBlock>

        <SettingsBlock
          label="Accent colour"
          description="Used for buttons, links, selection and the Hetex mark."
        >
          <div className="flex flex-wrap items-center gap-2">
            {ACCENTS.map((a) => (
              <button
                key={a.value}
                type="button"
                role="radio"
                aria-checked={values.accent === a.value}
                aria-label={a.label}
                title={a.label}
                onClick={() => set({ accent: a.value })}
                className={`focus-ring h-9 w-9 rounded-full border-2 transition-transform ${
                  values.accent === a.value
                    ? "scale-110 border-[var(--text-primary)]"
                    : "border-transparent hover:scale-105"
                }`}
                style={{ backgroundColor: a.swatch }}
              />
            ))}

            <label
              className={`focus-within-accent flex items-center gap-2 rounded-full border-2 px-2.5 py-1.5 text-xs transition-transform ${
                values.accent === "custom"
                  ? "scale-105 border-[var(--text-primary)]"
                  : "border-[var(--border-subtle)]"
              }`}
            >
              <span className="sr-only">Custom accent colour</span>
              <input
                type="color"
                aria-label="Custom accent colour"
                value={values.customAccent ?? "#14b366"}
                onChange={(e) =>
                  set({ accent: "custom", customAccent: e.target.value })
                }
                className="h-6 w-6 cursor-pointer rounded-full border-0 bg-transparent p-0"
              />
              Custom
            </label>
          </div>
        </SettingsBlock>
      </SettingsCard>

      <SettingsCard title="Surfaces">
        <SettingsRow
          label="Visual style"
          description="Glass uses translucent panels with a blur. Solid is opaque. Minimal removes the elevation entirely."
        >
          <SegmentedControl
            label="Visual style"
            value={values.visualStyle}
            onChange={(v) => set({ visualStyle: v })}
            options={[
              { value: "glass", label: "Glass" },
              { value: "solid", label: "Solid" },
              { value: "minimal", label: "Minimal" },
            ]}
          />
        </SettingsRow>

        <SettingsRow
          label="Background"
          description="A soft wash behind the interface, tinted with your accent."
        >
          <SegmentedControl
            label="Background"
            value={values.background}
            onChange={(v) => set({ background: v })}
            options={[
              { value: "gradient", label: "Gradient" },
              { value: "ambient", label: "Ambient" },
              { value: "minimal", label: "Subtle" },
              { value: "static", label: "Flat" },
              { value: "none", label: "None" },
            ]}
          />
        </SettingsRow>

        <SettingsRow
          label="Animations"
          description="Transitions and the typing indicator."
          unavailable={
            motionOverridden
              ? "Accessibility → Reduce motion is on, which overrides this and stops animation everywhere."
              : undefined
          }
        >
          <SegmentedControl
            label="Animations"
            value={values.animations}
            onChange={(v) => set({ animations: v })}
            options={[
              { value: "full", label: "Full" },
              { value: "reduced", label: "Reduced" },
              { value: "off", label: "Off" },
            ]}
            disabled={motionOverridden}
          />
        </SettingsRow>

        <SettingsRow
          label="Sidebar"
          description="Auto collapses it on a narrow window and expands it on a wide one."
        >
          <SegmentedControl
            label="Sidebar"
            value={values.sidebar}
            onChange={(v) => set({ sidebar: v })}
            options={[
              { value: "expanded", label: "Expanded" },
              { value: "collapsed", label: "Collapsed" },
              { value: "auto", label: "Auto" },
            ]}
          />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title="Chat">
        <SettingsBlock label="Message shape">
          <OptionCards
            label="Message shape"
            columns={2}
            value={values.bubbleStyle}
            onChange={(v) => set({ bubbleStyle: v })}
            options={[
              { value: "rounded", label: "Rounded", description: "Soft bubbles. The default." },
              { value: "square", label: "Square", description: "Tight corners, denser look." },
              {
                value: "minimal",
                label: "Minimal",
                description: "No bubble at all — messages read as plain text on the page.",
              },
            ]}
          />
        </SettingsBlock>

        <SettingsRow
          label="Message density"
          description="How much space sits between and inside messages."
        >
          <SegmentedControl
            label="Message density"
            value={values.messageDensity}
            onChange={(v) => set({ messageDensity: v })}
            options={[
              { value: "compact", label: "Compact" },
              { value: "comfortable", label: "Comfortable" },
              { value: "spacious", label: "Spacious" },
            ]}
          />
        </SettingsRow>

        <SettingsRow
          label="Font size"
          description="Scales the whole interface, not only message text."
          unavailable={
            textOverridden
              ? "Accessibility is set to large text, which takes precedence over this."
              : undefined
          }
        >
          <SegmentedControl
            label="Font size"
            value={values.fontSize}
            onChange={(v) => set({ fontSize: v })}
            options={[
              { value: "small", label: "S" },
              { value: "medium", label: "M" },
              { value: "large", label: "L" },
              { value: "xlarge", label: "XL" },
            ]}
            disabled={textOverridden}
          />
        </SettingsRow>

        <SettingsRow label="Code font size">
          <SegmentedControl
            label="Code font size"
            value={values.codeFontSize}
            onChange={(v) => set({ codeFontSize: v })}
            options={[
              { value: "small", label: "S" },
              { value: "medium", label: "M" },
              { value: "large", label: "L" },
            ]}
          />
        </SettingsRow>

        <SettingsRow label="Line spacing">
          <SegmentedControl
            label="Line spacing"
            value={values.lineSpacing}
            onChange={(v) => set({ lineSpacing: v })}
            options={[
              { value: "tight", label: "Tight" },
              { value: "normal", label: "Normal" },
              { value: "relaxed", label: "Relaxed" },
            ]}
          />
        </SettingsRow>
      </SettingsCard>

      <Callout title="Contrast and colour">
        Charts in the admin dashboard deliberately do not follow your accent.
        Their colours are fixed and checked for contrast and colour-blind
        legibility, which a user-selectable hue cannot be held to.
      </Callout>
    </>
  );
}
