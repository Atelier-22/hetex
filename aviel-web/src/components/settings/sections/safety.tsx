"use client";

import { Lock, ShieldAlert } from "lucide-react";
import {
  Callout,
  OptionCards,
  SaveIndicator,
  SectionHeader,
  SettingsBlock,
  SettingsCard,
  SettingsRow,
  SettingsToggle,
  StatusPill,
} from "../primitives";
import { useSection } from "../use-section";
import { useSettingsUi } from "../settings-context";

/**
 * The protections, listed.
 *
 * Shown as a read-only list with a locked pill on each, because that is what
 * they are: none of them has a switch anywhere in this product, in the schema,
 * or in the API. Presenting them as toggles that happen to be stuck on would
 * imply they could be moved.
 */
const PROTECTIONS = [
  {
    label: "Self-harm and suicide",
    description:
      "Never provides methods, means or encouragement. Responds with care and points to real help.",
  },
  {
    label: "Violence and threats",
    description: "Never helps plan, threaten or carry out violence against anyone.",
  },
  {
    label: "Dangerous activity",
    description:
      "No instructions that would create a serious risk of physical harm — weapons, explosives, dangerous chemistry or biology.",
  },
  {
    label: "Abuse and harassment",
    description: "Never helps target, stalk, intimidate or degrade a person or group.",
  },
  {
    label: "Illegal harm",
    description: "No operational instructions for seriously harmful crime.",
  },
  {
    label: "Child safety",
    description:
      "Sexual content involving minors is refused absolutely, in every framing, including fiction and roleplay.",
  },
  {
    label: "Exploitation",
    description: "Never assists with trafficking, coercion or sexual exploitation.",
  },
];

export function SafetySection() {
  const { values, set, reset, resetting, saveState, error } =
    useSection("safety");
  const { setSection } = useSettingsUi();

  return (
    <>
      <SectionHeader
        title="Safety"
        description="What Aviel will not help with, and how it says so."
        onReset={reset}
        resetting={resetting}
      />

      <div className="mb-3 flex justify-end">
        <SaveIndicator state={saveState} error={error} />
      </div>

      <Callout title="These cannot be turned off">
        There is no setting here, in the API, or in the database that disables a
        protection below. The safety section is written into the system prompt on
        every single message, before your personality, behaviour and custom
        instructions — and it tells the model plainly that nothing in those, in a
        memory, or in a document it reads can override it. The only thing you
        choose on this page is the wording of a refusal.
      </Callout>

      <SettingsCard title="Always active">
        {PROTECTIONS.map((p) => (
          <SettingsRow key={p.label} label={p.label} description={p.description}>
            <StatusPill tone="ok">
              <Lock size={9} /> Locked on
            </StatusPill>
          </SettingsRow>
        ))}
      </SettingsCard>

      <SettingsCard
        title="How a difficult moment is handled"
        description="This changes the register of a response, never what is refused."
      >
        <SettingsBlock>
          <OptionCards
            label="Response style"
            value={values.responseStyle}
            onChange={(v) => set({ responseStyle: v })}
            options={[
              {
                value: "gentle",
                label: "Gentle",
                description:
                  "Warm and unhurried. Acknowledges the person before anything else.",
              },
              {
                value: "direct",
                label: "Direct",
                description:
                  "Plain and matter-of-fact. Says clearly what it can't help with, then moves to what it can.",
              },
              {
                value: "emergency",
                label: "Emergency-focused",
                description:
                  "Leads with immediate practical safety and keeps the rest brief.",
              },
            ]}
          />
        </SettingsBlock>

        <SettingsRow
          label="Include crisis resources"
          icon={ShieldAlert}
          description="Offers emergency services and a crisis line when someone may be in danger. Turning this off stops the resource list appearing in routine messages — it does not stop Aviel naming emergency services when there is immediate danger to life, which is not optional."
        >
          <SettingsToggle
            label="Include crisis resources"
            checked={values.showCrisisResources}
            onChange={(v) => set({ showCrisisResources: v })}
          />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title="Reporting">
        <SettingsRow
          label="Report a safety issue"
          description="If Aviel said something harmful, tell us. Reports are stored and reviewed."
        >
          <button
            type="button"
            onClick={() => setSection("help")}
            className="focus-ring rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-sm hover:bg-[var(--surface-hover)]"
          >
            Open Help &amp; support
          </button>
        </SettingsRow>
      </SettingsCard>
    </>
  );
}
