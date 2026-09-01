"use client";

import { Radio } from "lucide-react";
import {
  Callout,
  SaveIndicator,
  SectionHeader,
  SettingsCard,
  SettingsRow,
  SettingsSlider,
  SettingsToggle,
  StatusPill,
} from "../primitives";
import { useSection } from "../use-section";
import { useSpeechVoices } from "@/lib/speech";

/** The states a live session moves through. Shown so the UI is predictable. */
const STATES: { id: string; label: string; description: string }[] = [
  { id: "idle", label: "Idle", description: "Ready, not listening." },
  { id: "listening", label: "Listening", description: "Your microphone is open." },
  { id: "thinking", label: "Thinking", description: "Your message has been sent and a reply is being generated." },
  { id: "speaking", label: "Speaking", description: "Reading the reply aloud." },
  { id: "muted", label: "Muted", description: "The microphone is off; the session is still open." },
  { id: "offline", label: "Offline", description: "No connection, so nothing can be sent." },
  { id: "error", label: "Error", description: "Something failed. The reason is shown in the panel." },
];

export function LiveVoiceSection() {
  const { values, set, reset, resetting, saveState, error, meta } =
    useSection("liveVoice");
  const { ttsSupported, sttSupported } = useSpeechVoices();

  const browserCapable = ttsSupported && sttSupported;
  const disabledByAdmin =
    meta?.features?.liveVoice === false || meta?.features?.voice === false;

  return (
    <>
      <SectionHeader
        title="Live voice"
        description="A hands-free back-and-forth: it listens, sends, answers aloud, and listens again."
        onReset={reset}
        resetting={resetting}
      />

      <div className="mb-3 flex justify-end">
        <SaveIndicator state={saveState} error={error} />
      </div>

      {!browserCapable && (
        <Callout tone="warn" title="Not available in this browser">
          Live voice needs both speech recognition and speech synthesis.{" "}
          {!sttSupported && "This browser has no speech recognition. "}
          {!ttsSupported && "This browser has no speech synthesis. "}
          Chrome and Edge support both.
        </Callout>
      )}

      {disabledByAdmin && (
        <Callout tone="warn" title="Live voice is unavailable">
          An administrator has turned it off for this server.
        </Callout>
      )}

      <SettingsCard title="Session">
        <SettingsRow
          label="Live voice"
          icon={Radio}
          description="Adds a live voice button to the chat composer."
        >
          <SettingsToggle
            label="Live voice"
            checked={values.enabled}
            onChange={(v) => set({ enabled: v })}
            disabled={!browserCapable || disabledByAdmin}
          />
        </SettingsRow>

        <SettingsRow
          label="Keep listening"
          description="Reopens the microphone after each reply, so you can talk without pressing anything. Off listens once per turn."
        >
          <SettingsToggle
            label="Keep listening"
            checked={values.continuousListening}
            onChange={(v) => set({ continuousListening: v })}
            disabled={!values.enabled}
          />
        </SettingsRow>

        <SettingsRow
          label="Detect when you stop speaking"
          description="Sends on a natural pause rather than waiting for you to press stop."
        >
          <SettingsToggle
            label="Detect when you stop speaking"
            checked={values.voiceActivityDetection}
            onChange={(v) => set({ voiceActivityDetection: v })}
            disabled={!values.enabled}
          />
        </SettingsRow>

        <SettingsRow
          label="Send automatically"
          description="Off leaves each transcript on screen for you to send or discard."
        >
          <SettingsToggle
            label="Send automatically"
            checked={values.autoResponse}
            onChange={(v) => set({ autoResponse: v })}
            disabled={!values.enabled}
          />
        </SettingsRow>

        <SettingsRow
          label="Maximum session length"
          description="The session ends by itself after this long, so a forgotten open microphone does not stay open."
        >
          <SettingsSlider
            label="Maximum session length"
            value={values.maxSessionMinutes}
            min={1}
            max={60}
            step={1}
            disabled={!values.enabled}
            onCommit={(v) => set({ maxSessionMinutes: v })}
            format={(v) => `${v} min`}
          />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title="Interruption">
        <SettingsRow
          label="Let me interrupt"
          description="Speaking while Hetex is talking stops it and starts listening to you."
        >
          <SettingsToggle
            label="Let me interrupt"
            checked={values.allowInterrupt}
            onChange={(v) => set({ allowInterrupt: v })}
            disabled={!values.enabled}
          />
        </SettingsRow>

        <SettingsRow
          label="Let Hetex interrupt me"
          description="Starts answering on a short pause rather than waiting for a long one. Faster, and more likely to cut you off mid-thought."
        >
          <SettingsToggle
            label="Let Hetex interrupt me"
            checked={values.allowAiInterruption}
            onChange={(v) => set({ allowAiInterruption: v })}
            disabled={!values.enabled}
          />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title="Transcript and audio">
        <SettingsRow
          label="Show the transcript"
          description="Displays what was heard and what was said during the session."
        >
          <SettingsToggle
            label="Show the transcript"
            checked={values.showTranscript}
            onChange={(v) => set({ showTranscript: v })}
            disabled={!values.enabled}
          />
        </SettingsRow>

        <SettingsRow
          label="Save the transcript"
          description="Keeps the session as a normal conversation in your history. Off means it disappears when the session ends."
        >
          <SettingsToggle
            label="Save the transcript"
            checked={values.saveTranscript}
            onChange={(v) => set({ saveTranscript: v })}
            disabled={!values.enabled}
          />
        </SettingsRow>

        <SettingsRow
          label="Save the audio"
          unavailable="Hetex has no audio store, so recordings cannot be kept. Nothing you say is recorded or uploaded — the microphone feeds your browser's speech recognition and nothing else."
        >
          <StatusPill tone="off">Unavailable</StatusPill>
        </SettingsRow>

        <SettingsRow
          label="Delete audio automatically"
          unavailable="There is no audio to delete, for the reason above."
        >
          <StatusPill tone="neutral">Not applicable</StatusPill>
        </SettingsRow>
      </SettingsCard>

      <SettingsCard
        title="Session states"
        description="What the live voice panel will show you, and what each state means."
      >
        {STATES.map((s) => (
          <SettingsRow key={s.id} label={s.label} description={s.description}>
            <StatusPill
              tone={
                s.id === "error" || s.id === "offline"
                  ? "off"
                  : s.id === "listening" || s.id === "speaking"
                    ? "ok"
                    : "neutral"
              }
            >
              {s.id}
            </StatusPill>
          </SettingsRow>
        ))}
      </SettingsCard>
    </>
  );
}
