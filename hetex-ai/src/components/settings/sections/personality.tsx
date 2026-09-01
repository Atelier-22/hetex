"use client";

import { useEffect, useState } from "react";
import {
  OptionCards,
  SaveIndicator,
  SectionHeader,
  SegmentedControl,
  SettingsBlock,
  SettingsButton,
  SettingsCard,
  SettingsRow,
  TextField,
} from "../primitives";
import { useSection } from "../use-section";

const MAX_INSTRUCTIONS = 4000;

const PERSONAS = [
  { value: "friendly" as const, label: "Friendly", description: "Warm and approachable, like a knowledgeable friend." },
  { value: "professional" as const, label: "Professional", description: "Precise and courteous, with no chattiness." },
  { value: "casual" as const, label: "Casual", description: "Relaxed and plain-spoken." },
  { value: "academic" as const, label: "Academic", description: "Rigorous. Defines terms and qualifies claims." },
  { value: "creative" as const, label: "Creative", description: "Offers unexpected angles and vivid framing." },
  { value: "direct" as const, label: "Direct", description: "Leads with the answer. Cuts every hedge." },
  { value: "supportive" as const, label: "Supportive", description: "Patient, and breaks hard things into pieces." },
  { value: "concise" as const, label: "Concise", description: "The most meaning in the fewest words." },
];

export function PersonalitySection() {
  const { values, set, reset, resetting, saveState, error } =
    useSection("personality");

  const [instructions, setInstructions] = useState(values.customInstructions ?? "");

  useEffect(() => {
    setInstructions(values.customInstructions ?? "");
  }, [values.customInstructions]);

  const dirty = instructions !== (values.customInstructions ?? "");

  return (
    <>
      <SectionHeader
        title="AI personality"
        description="How Hetex sounds. Every choice here goes into the system prompt for your next message — existing conversations included."
        onReset={reset}
        resetting={resetting}
      />

      <div className="mb-3 flex justify-end">
        <SaveIndicator state={saveState} error={error} />
      </div>

      <SettingsCard title="Personality">
        <SettingsBlock>
          <OptionCards
            label="Personality"
            columns={2}
            value={values.persona}
            onChange={(v) => set({ persona: v })}
            options={PERSONAS}
          />
        </SettingsBlock>
      </SettingsCard>

      <SettingsCard title="Voice and register">
        <SettingsRow
          label="Response style"
          description="How much you get back before you have to ask for more."
        >
          <SegmentedControl
            label="Response style"
            value={values.responseStyle}
            onChange={(v) => set({ responseStyle: v })}
            options={[
              { value: "concise", label: "Concise" },
              { value: "balanced", label: "Balanced" },
              { value: "detailed", label: "Detailed" },
              { value: "very_detailed", label: "Very detailed" },
            ]}
          />
        </SettingsRow>

        <SettingsRow label="Tone">
          <SegmentedControl
            label="Tone"
            value={values.tone}
            onChange={(v) => set({ tone: v })}
            options={[
              { value: "warm", label: "Warm" },
              { value: "neutral", label: "Neutral" },
              { value: "professional", label: "Professional" },
              { value: "enthusiastic", label: "Keen" },
              { value: "calm", label: "Calm" },
            ]}
          />
        </SettingsRow>

        <SettingsRow
          label="Creativity"
          description="Low prefers the standard answer. High offers more than one approach where more than one is reasonable."
        >
          <SegmentedControl
            label="Creativity"
            value={values.creativity}
            onChange={(v) => set({ creativity: v })}
            options={[
              { value: "low", label: "Low" },
              { value: "medium", label: "Medium" },
              { value: "high", label: "High" },
            ]}
          />
        </SettingsRow>

        <SettingsRow label="Formality">
          <SegmentedControl
            label="Formality"
            value={values.formality}
            onChange={(v) => set({ formality: v })}
            options={[
              { value: "casual", label: "Casual" },
              { value: "balanced", label: "Balanced" },
              { value: "formal", label: "Formal" },
            ]}
          />
        </SettingsRow>

        <SettingsRow
          label="Assistant name"
          description="What Hetex calls itself in a reply."
        >
          <TextField
            label="Assistant name"
            className="w-48"
            value={values.assistantName}
            onCommit={(v) => v.trim() && set({ assistantName: v.trim() })}
            maxLength={80}
          />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard
        title="Custom instructions"
        description="Added to the system prompt on every conversation, new and existing. Safety rules always take precedence over anything written here."
      >
        <SettingsBlock>
          <textarea
            value={instructions}
            aria-label="Custom instructions"
            onChange={(e) =>
              setInstructions(e.target.value.slice(0, MAX_INSTRUCTIONS))
            }
            onBlur={() =>
              dirty && set({ customInstructions: instructions.trim() || null })
            }
            rows={6}
            placeholder="e.g. I'm a developer working mostly in TypeScript. Skip the preamble and show me code."
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
                set({ customInstructions: instructions.trim() || null })
              }
            >
              Save instructions
            </SettingsButton>
          </div>
        </SettingsBlock>
      </SettingsCard>
    </>
  );
}
