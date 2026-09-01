"use client";

import { useEffect, useState } from "react";
import { Contrast, Keyboard, Type, Vibrate } from "lucide-react";
import {
  Callout,
  SaveIndicator,
  SectionHeader,
  SettingsCard,
  SettingsRow,
  SettingsToggle,
  StatusPill,
} from "../primitives";
import { useSection } from "../use-section";
import { haptic } from "@/lib/speech";

export function AccessibilitySection() {
  const { values, set, reset, resetting, saveState, error } =
    useSection("accessibility");

  const [systemReducedMotion, setSystemReducedMotion] = useState(false);
  const [vibrationSupported, setVibrationSupported] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const read = () => setSystemReducedMotion(mq.matches);
    read();
    mq.addEventListener("change", read);
    setVibrationSupported("vibrate" in navigator);
    return () => mq.removeEventListener("change", read);
  }, []);

  return (
    <>
      <SectionHeader
        title="Accessibility"
        description="These take precedence over Appearance, so a choice made here is not quietly undone by a style preference."
        onReset={reset}
        resetting={resetting}
      />

      <div className="mb-3 flex justify-end">
        <SaveIndicator state={saveState} error={error} />
      </div>

      <SettingsCard title="Text">
        <SettingsRow
          label="Large text"
          icon={Type}
          description="Scales the whole interface up a step, overriding the font size in Appearance."
        >
          <SettingsToggle
            label="Large text"
            checked={values.largeText}
            onChange={(v) => set({ largeText: v })}
          />
        </SettingsRow>

        <SettingsRow
          label="Extra large text"
          description="A further step up. Takes precedence over Large text."
        >
          <SettingsToggle
            label="Extra large text"
            checked={values.extraLargeText}
            onChange={(v) => set({ extraLargeText: v })}
          />
        </SettingsRow>

        <SettingsRow
          label="Bold text"
          description="Increases the weight of body text and labels."
        >
          <SettingsToggle
            label="Bold text"
            checked={values.boldText}
            onChange={(v) => set({ boldText: v })}
          />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title="Contrast and motion">
        <SettingsRow
          label="High contrast"
          icon={Contrast}
          description="Strengthens borders and secondary text. Your accent colour is left alone, because it already carries meaning."
        >
          <SettingsToggle
            label="High contrast"
            checked={values.highContrast}
            onChange={(v) => set({ highContrast: v })}
          />
        </SettingsRow>

        <SettingsRow
          label="Reduce motion"
          description="Stops transitions and the animated typing indicator everywhere."
          unavailable={
            systemReducedMotion
              ? "Your system already asks for reduced motion, and Aviel honours that regardless of this switch."
              : undefined
          }
        >
          <div className="flex items-center gap-2">
            {systemReducedMotion && <StatusPill tone="ok">System</StatusPill>}
            <SettingsToggle
              label="Reduce motion"
              checked={values.reduceMotion}
              onChange={(v) => set({ reduceMotion: v })}
            />
          </div>
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title="Navigation and input">
        <SettingsRow
          label="Keyboard navigation"
          icon={Keyboard}
          description="Every control in Aviel is reachable by Tab and operable by Enter or Space, and shows a visible focus ring. This is not optional and cannot be turned off."
        >
          <StatusPill tone="ok">Always on</StatusPill>
        </SettingsRow>

        <SettingsRow
          label="Screen reader hints"
          description="Adds extra descriptive text for assistive technology. Controls are labelled either way — this adds context, it does not add labels that were missing."
        >
          <SettingsToggle
            label="Screen reader hints"
            checked={values.screenReaderHints}
            onChange={(v) => set({ screenReaderHints: v })}
          />
        </SettingsRow>

        <SettingsRow
          label="Larger touch targets"
          description="Raises the minimum height of buttons and inputs to 44 pixels."
        >
          <SettingsToggle
            label="Larger touch targets"
            checked={values.largerButtons}
            onChange={(v) => set({ largerButtons: v })}
          />
        </SettingsRow>

        <SettingsRow
          label="Voice navigation"
          unavailable="Controlling the interface by voice is not built. Dictation into the composer works and is set up in Voice; that is a different thing, and calling it voice navigation would be misleading."
        >
          <StatusPill tone="off">Not built</StatusPill>
        </SettingsRow>

        <SettingsRow
          label="Captions"
          unavailable="Aviel plays no audio or video other than reading a reply aloud, and that reply is already on screen as text. There is nothing to caption."
        >
          <StatusPill tone="neutral">Not applicable</StatusPill>
        </SettingsRow>

        <SettingsRow
          label="Haptic feedback"
          icon={Vibrate}
          description="A brief vibration on interaction."
          unavailable={
            vibrationSupported
              ? undefined
              : "This device has no vibration hardware, or the browser does not expose it. The preference is stored for devices that do."
          }
        >
          <div className="flex items-center gap-2">
            {vibrationSupported && values.hapticFeedback && (
              <button
                type="button"
                onClick={() => haptic({ hapticFeedback: true }, 30)}
                className="focus-ring rounded-lg border border-[var(--border-subtle)] px-2.5 py-1.5 text-xs hover:bg-[var(--surface-hover)]"
              >
                Test
              </button>
            )}
            <SettingsToggle
              label="Haptic feedback"
              checked={values.hapticFeedback}
              onChange={(v) => set({ hapticFeedback: v })}
              disabled={!vibrationSupported}
            />
          </div>
        </SettingsRow>
      </SettingsCard>

      <Callout title="Keyboard shortcuts">
        Enter or Ctrl+Enter sends a message, depending on your choice in
        Conversations. Escape closes settings and any open menu. On a phone,
        Escape steps back to the category list first.
      </Callout>
    </>
  );
}
