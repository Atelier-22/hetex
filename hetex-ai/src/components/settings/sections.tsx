"use client";

import { SectionHeader } from "./primitives";
import type { SectionId } from "./settings-context";

/**
 * Section shells.
 *
 * Deliberately empty for now: the shell and its navigation ship first, then
 * each section is wired to its endpoint one at a time. A placeholder that says
 * so is honest; a screen full of toggles that do nothing is not.
 */

const PENDING: Record<SectionId, { title: string; description: string }> = {
  general: {
    title: "General",
    description: "Theme, text size, language, model, and app version.",
  },
  notifications: {
    title: "Notifications",
    description: "Choose how you hear about responses, tasks, and usage.",
  },
  personalization: {
    title: "Personalization",
    description: "Custom instructions and what Hetex AI remembers about you.",
  },
  plugins: {
    title: "Plugins",
    description: "Tools and integrations connected to your account.",
  },
  voice: {
    title: "Voice",
    description: "Dictation and Read Aloud preferences.",
  },
  billing: {
    title: "Billing",
    description: "Your plan and payment details.",
  },
  "data-controls": {
    title: "Data controls",
    description: "Chat history, exporting your data, and deleting your account.",
  },
  storage: {
    title: "Storage",
    description: "What this account is storing.",
  },
  security: {
    title: "Security and login",
    description: "Password and the devices signed in to your account.",
  },
  account: {
    title: "Account",
    description: "Your profile and how you sign in.",
  },
  keyboard: {
    title: "Keyboard",
    description: "Keyboard shortcuts.",
  },
};

export function SettingsSection({ id }: { id: SectionId }) {
  const meta = PENDING[id];

  return (
    <>
      <SectionHeader title={meta.title} description={meta.description} />
      <div className="rounded-xl border border-dashed border-[var(--border-subtle)] px-4 py-8 text-center">
        <p className="text-sm text-[var(--text-secondary)]">
          Being built next.
        </p>
        <p className="mx-auto mt-1 max-w-sm text-xs text-[var(--text-secondary)]">
          Each section is wired to its own endpoint before its controls appear
          here, so nothing on this screen is decorative.
        </p>
      </div>
    </>
  );
}
