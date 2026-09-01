"use client";

import { Languages, MessageSquare, Mic, Volume2 } from "lucide-react";
import {
  Callout,
  SaveIndicator,
  SectionHeader,
  SettingsCard,
  SettingsDropdown,
  SettingsRow,
  SettingsToggle,
  StatusPill,
} from "../primitives";
import { useSection } from "../use-section";

export function LanguageSection() {
  const { values, set, reset, resetting, saveState, error, meta } =
    useSection("language");

  const interfaceLanguages = meta?.interfaceLanguages ?? [
    { value: "auto", label: "Auto-detect" },
    { value: "en", label: "English" },
  ];
  const aiLanguages = meta?.aiLanguages ?? [
    { value: "auto", label: "Match my message" },
    { value: "en", label: "English" },
  ];
  const translationsAvailable = meta?.interfaceTranslationsAvailable === true;

  return (
    <>
      <SectionHeader
        title="Language"
        description="What language Aviel reads, replies in, and speaks."
        onReset={reset}
        resetting={resetting}
      />

      <div className="mb-3 flex justify-end">
        <SaveIndicator state={saveState} error={error} />
      </div>

      <SettingsCard title="Replies">
        <SettingsRow
          label="AI response language"
          icon={MessageSquare}
          description="Passed to the model, so this genuinely changes what comes back — including when you write in a different language."
        >
          <SettingsDropdown
            label="AI response language"
            value={values.aiResponse}
            onChange={(v) => set({ aiResponse: v })}
            options={aiLanguages}
          />
        </SettingsRow>

        <SettingsRow
          label="Match the language I write in"
          description="On 'Match my message', Aviel replies in whatever language your message was written in."
        >
          <SettingsToggle
            label="Match the language I write in"
            checked={values.autoDetect}
            onChange={(v) => set({ autoDetect: v })}
            disabled={values.aiResponse !== "auto"}
          />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title="Interface">
        <SettingsRow
          label="Application language"
          icon={Languages}
          unavailable={
            translationsAvailable
              ? undefined
              : "Aviel has no translations yet, so the interface is English. Your choice is stored and will apply when translations ship — nothing here claims a language the app cannot actually display."
          }
        >
          <div className="flex items-center gap-2">
            {!translationsAvailable && <StatusPill>English only</StatusPill>}
            <SettingsDropdown
              label="Application language"
              value={values.app}
              onChange={(v) => set({ app: v })}
              options={interfaceLanguages}
              disabled={!translationsAvailable}
            />
          </div>
        </SettingsRow>
      </SettingsCard>

      <SettingsCard
        title="Voice"
        description="Set separately from the interface, because people routinely dictate in one language and read menus in another."
      >
        <SettingsRow
          label="Voice input language"
          icon={Mic}
          description="Also settable in Voice. The two are the same value."
        >
          <SettingsDropdown
            label="Voice input language"
            value={values.voiceInput}
            onChange={(v) => set({ voiceInput: v })}
            options={[
              { value: "auto", label: "Follow my browser" },
              ...aiLanguages.filter((l) => l.value !== "auto"),
            ]}
          />
        </SettingsRow>

        <SettingsRow
          label="Voice output language"
          icon={Volume2}
          description="Which installed voice is preferred when a reply is read aloud. A device without a voice for that language falls back to its default."
        >
          <SettingsDropdown
            label="Voice output language"
            value={values.voiceOutput}
            onChange={(v) => set({ voiceOutput: v })}
            options={[
              { value: "auto", label: "Match the reply" },
              ...aiLanguages.filter((l) => l.value !== "auto"),
            ]}
          />
        </SettingsRow>
      </SettingsCard>

      <Callout title="What is and is not translated">
        The model can answer in any language it knows, and that is what the top
        setting controls. The buttons, labels and help text in this app are
        English until translations exist. Saying otherwise would be a claim the
        product cannot keep.
      </Callout>
    </>
  );
}
