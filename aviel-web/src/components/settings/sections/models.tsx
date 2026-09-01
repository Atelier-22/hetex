"use client";

import { Cpu, Globe, HardDrive, Route, ShieldCheck } from "lucide-react";
import {
  Callout,
  LoadingRows,
  OptionCards,
  SaveIndicator,
  SectionHeader,
  SettingsBlock,
  SettingsCard,
  SettingsDropdown,
  SettingsRow,
  SettingsToggle,
  StatusPill,
} from "../primitives";
import { useSection } from "../use-section";
import { useSettingsUi } from "../settings-context";

const TASK_MODELS = [
  {
    key: "fastModel" as const,
    label: "Fast",
    hint: "Short questions and quick lookups.",
  },
  {
    key: "reasoningModel" as const,
    label: "Reasoning",
    hint: "Maths, proofs, architecture, anything that needs working through.",
  },
  {
    key: "visionModel" as const,
    label: "Vision",
    hint: "Messages with an image attached. Must be a model that can see.",
  },
  {
    key: "codingModel" as const,
    label: "Coding",
    hint: "Code, stack traces, refactors.",
  },
];

export function ModelsSection() {
  const { values, set, reset, resetting, saveState, error, meta, settings } =
    useSection("ai");
  const { setSection } = useSettingsUi();

  const models = meta?.models ?? [];
  const providers = meta?.providers ?? [];
  const localAI = meta?.localAI;

  const modelOptions = [
    { value: "", label: "Use the default model" },
    ...models.map((m) => ({ value: m.value, label: m.label })),
  ];

  const localOnly = settings.privacy.localOnly;

  return (
    <>
      <SectionHeader
        title="AI & models"
        description="Which model answers you, where it runs, and when Aviel chooses for you."
        onReset={reset}
        resetting={resetting}
      />

      <div className="mb-3 flex justify-end">
        <SaveIndicator state={saveState} error={error} />
      </div>

      {localOnly && (
        <Callout title="Local processing is on" tone="warn">
          Privacy &amp; data is set to process everything on this server, so the
          model chosen below is overridden and every message is answered by the
          local runtime.{" "}
          <button
            type="button"
            onClick={() => setSection("privacy")}
            className="focus-ring rounded underline underline-offset-2"
          >
            Change that in Privacy &amp; data
          </button>
          .
        </Callout>
      )}

      {/* ---- Providers ---- */}
      <SettingsCard
        title="Where your messages are processed"
        description="Only providers this server actually has are listed. Anything not configured says so rather than being offered."
      >
        {!meta && (
          <div className="py-4">
            <LoadingRows count={2} />
          </div>
        )}

        {providers.map((p) => (
          <div
            key={p.id}
            className="flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] py-4 last:border-b-0"
          >
            <div className="flex min-w-0 gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                {p.local ? <HardDrive size={16} /> : <Globe size={16} />}
              </span>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {p.label}
                  {p.vendor && (
                    <span className="text-xs font-normal text-[var(--text-secondary)]">
                      {p.vendor}
                    </span>
                  )}
                  <StatusPill tone={p.configured ? "ok" : "neutral"}>
                    {p.configured ? "Available" : "Not configured"}
                  </StatusPill>
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
                  {p.local
                    ? "Runs on the Aviel server. No API key, and nothing leaves the machine."
                    : "Runs on a hosted service. Messages sent to it leave this server."}
                </p>
                <p className="mt-1.5 flex flex-wrap gap-1.5">
                  <StatusPill tone={p.capabilities.webSearch ? "ok" : "neutral"}>
                    {p.capabilities.webSearch ? "Web search" : "No web search"}
                  </StatusPill>
                  <StatusPill tone={p.capabilities.images ? "ok" : "neutral"}>
                    {p.capabilities.images ? "Reads images" : "No images"}
                  </StatusPill>
                  <StatusPill>
                    {p.models.length} model{p.models.length === 1 ? "" : "s"}
                  </StatusPill>
                </p>
                {!p.configured && !p.local && (
                  <p className="mt-1.5 text-xs text-[var(--text-secondary)]">
                    An API key would have to be set in the server environment.
                    Keys are never held in the browser.
                  </p>
                )}
                {!p.configured && p.local && localAI?.requirement && (
                  <p className="mt-1.5 text-xs text-[var(--text-secondary)]">
                    {localAI.requirement}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </SettingsCard>

      {/* ---- Default model ---- */}
      <SettingsCard
        title="Default model"
        description="Used for every message unless automatic selection picks a different one."
      >
        <SettingsBlock>
          {!meta && <LoadingRows count={2} />}

          {meta && models.length === 0 && (
            <p className="text-sm text-[var(--text-secondary)]">
              No models are available on this server. Either no API key is set,
              or no local runtime is reachable.
            </p>
          )}

          {models.length > 0 && (
            <OptionCards
              label="Default model"
              value={values.defaultModel}
              onChange={(v) => set({ defaultModel: v })}
              options={models.map((m) => ({
                value: m.value,
                label: m.label,
                description: (
                  <>
                    {m.description}
                    <span className="mt-2 flex flex-wrap gap-1.5">
                      <StatusPill tone={m.local ? "accent" : "neutral"}>
                        {m.local ? "On this server" : "Hosted"}
                      </StatusPill>
                      <StatusPill tone={m.capabilities.webSearch ? "ok" : "neutral"}>
                        {m.capabilities.webSearch ? "Web search" : "No web search"}
                      </StatusPill>
                      <StatusPill tone={m.capabilities.images ? "ok" : "neutral"}>
                        {m.capabilities.images ? "Reads images" : "No images"}
                      </StatusPill>
                    </span>
                  </>
                ),
              }))}
            />
          )}
        </SettingsBlock>
      </SettingsCard>

      {/* ---- Routing ---- */}
      <SettingsCard
        title="Automatic model selection"
        description="Aviel classifies each message and sends it to the model you have assigned to that kind of work. Anything it cannot classify uses your default."
      >
        <SettingsRow
          label="Choose the model automatically"
          icon={Route}
          description="Routing happens on the server before the message is sent. The reply says which model answered when 'Show model used' is on in Conversations."
        >
          <SettingsToggle
            label="Choose the model automatically"
            checked={values.autoRouting}
            onChange={(v) => set({ autoRouting: v })}
            disabled={models.length === 0}
          />
        </SettingsRow>

        {TASK_MODELS.map((task) => (
          <SettingsRow
            key={task.key}
            label={`${task.label} model`}
            description={task.hint}
            unavailable={
              !values.autoRouting
                ? undefined
                : task.key === "visionModel" &&
                    values.visionModel &&
                    !models.find((m) => m.value === values.visionModel)
                      ?.capabilities.images
                  ? "That model cannot read images, so image messages will fall back to your default."
                  : undefined
            }
          >
            <SettingsDropdown
              label={`${task.label} model`}
              value={values[task.key] ?? ""}
              disabled={!values.autoRouting || models.length === 0}
              onChange={(v) => set({ [task.key]: v || null } as never)}
              options={modelOptions}
            />
          </SettingsRow>
        ))}
      </SettingsCard>

      {/* ---- Behaviour ---- */}
      <SettingsCard title="How models are used">
        <SettingsRow
          label="Let Aviel search the web"
          icon={Globe}
          description="Only models that have a search tool can do this; the rest are told plainly that they cannot look things up."
          unavailable={
            meta && meta.features?.webSearch === false
              ? "Web search is turned off for this server by an administrator."
              : undefined
          }
        >
          <SettingsToggle
            label="Let Aviel search the web"
            checked={values.webSearch}
            onChange={(v) => set({ webSearch: v })}
            disabled={meta?.features?.webSearch === false}
          />
        </SettingsRow>

        <SettingsRow
          label="Fall back to the local model"
          icon={Cpu}
          description="If the hosted service fails or times out, answer from the model on this server instead of showing an error."
          unavailable={
            localAI && !localAI.available
              ? "No local runtime is available on this server, so there is nothing to fall back to."
              : undefined
          }
        >
          <SettingsToggle
            label="Fall back to the local model"
            checked={values.fallbackToLocal}
            onChange={(v) => set({ fallbackToLocal: v })}
            disabled={!localAI?.available}
          />
        </SettingsRow>

        <SettingsRow
          label="Local AI and installed models"
          icon={ShieldCheck}
          description="Runtime status, what is installed, and how much memory each model needs."
        >
          <button
            type="button"
            onClick={() => setSection("offline")}
            className="focus-ring rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-sm hover:bg-[var(--surface-hover)]"
          >
            Open Local AI
          </button>
        </SettingsRow>
      </SettingsCard>
    </>
  );
}
