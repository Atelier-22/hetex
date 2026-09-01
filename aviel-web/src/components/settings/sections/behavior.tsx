"use client";

import {
  SaveIndicator,
  SectionHeader,
  SettingsCard,
  SettingsRow,
  SettingsToggle,
} from "../primitives";
import { useSection } from "../use-section";
import type { UserSettings } from "@/lib/settings/types";

type Key = keyof UserSettings["behavior"];

/**
 * Every toggle here becomes a line in the system prompt. The descriptions say
 * what the model is actually told, so nothing here is a vague mood setting.
 */
const ANSWERING: { key: Key; label: string; description: string }[] = [
  {
    key: "askFollowUps",
    label: "Ask follow-up questions",
    description: "End with a question when one would genuinely move things forward — not for the sake of it.",
  },
  {
    key: "explainAnswers",
    label: "Explain answers",
    description: "Say why, not only what.",
  },
  {
    key: "showReasoning",
    label: "Show reasoning summaries",
    description: "On non-trivial problems, summarise how it got there before the conclusion.",
  },
  {
    key: "giveExamples",
    label: "Give examples",
    description: "Use concrete examples where they make the point clearer.",
  },
  {
    key: "stepByStep",
    label: "Answer step by step",
    description: "Give procedures as numbered steps.",
  },
];

const CONTEXT: { key: Key; label: string; description: string }[] = [
  {
    key: "rememberContext",
    label: "Carry context through a conversation",
    description: "Keep assumptions from earlier turns rather than treating each message alone.",
  },
  {
    key: "useConversationContext",
    label: "Use earlier messages",
    description: "Draw on what was said before, not only the message in front of it.",
  },
  {
    key: "avoidRepetition",
    label: "Avoid repetition",
    description: "Do not restate what has already been said in this conversation.",
  },
  {
    key: "autoSummarizeLong",
    label: "Recap long conversations",
    description: "Open with a one-line summary of where things stand once a thread gets long.",
  },
];

const HONESTY: { key: Key; label: string; description: string }[] = [
  {
    key: "citeSources",
    label: "Cite sources",
    description: "Link the pages it used, whenever it used one.",
  },
  {
    key: "verifyInformation",
    label: "Verify what it can",
    description: "Check a claim before asserting it where that is possible, and say when it could not.",
  },
  {
    key: "admitUncertainty",
    label: "Admit uncertainty",
    description: "Say plainly when it is unsure, rather than guessing.",
  },
];

const FORMAT: { key: Key; label: string; description: string }[] = [
  { key: "useMarkdown", label: "Markdown", description: "Headings, emphasis and links. Off means plain text." },
  { key: "codeFormatting", label: "Code blocks", description: "Fenced and syntax-highlighted code." },
  { key: "useTables", label: "Tables", description: "Used when comparing several things across the same dimensions." },
  { key: "useBullets", label: "Bullet lists", description: "Off means prose instead of lists." },
];

export function BehaviorSection() {
  const { values, set, reset, resetting, saveState, error } =
    useSection("behavior");

  const rows = (items: { key: Key; label: string; description: string }[]) =>
    items.map((item) => (
      <SettingsRow key={item.key} label={item.label} description={item.description}>
        <SettingsToggle
          label={item.label}
          checked={values[item.key]}
          onChange={(v) => set({ [item.key]: v } as never)}
        />
      </SettingsRow>
    ));

  return (
    <>
      <SectionHeader
        title="AI behavior"
        description="What Aviel does when it answers. Each of these is passed into the system prompt, so a change applies from your next message."
        onReset={reset}
        resetting={resetting}
      />

      <div className="mb-3 flex justify-end">
        <SaveIndicator state={saveState} error={error} />
      </div>

      <SettingsCard title="Answering">{rows(ANSWERING)}</SettingsCard>
      <SettingsCard title="Context">{rows(CONTEXT)}</SettingsCard>
      <SettingsCard title="Accuracy">{rows(HONESTY)}</SettingsCard>
      <SettingsCard
        title="Formatting"
        description="How replies are laid out. These affect the text the model produces, not how the app renders it."
      >
        {rows(FORMAT)}
      </SettingsCard>
    </>
  );
}
