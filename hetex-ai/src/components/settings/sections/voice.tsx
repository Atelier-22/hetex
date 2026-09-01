"use client";

import { useEffect, useState } from "react";
import { Mic, Play, Square, Volume2 } from "lucide-react";
import {
  Callout,
  SaveIndicator,
  SectionHeader,
  SegmentedControl,
  SettingsButton,
  SettingsCard,
  SettingsDropdown,
  SettingsRow,
  SettingsSlider,
  SettingsToggle,
  StatusPill,
} from "../primitives";
import { useSection } from "../use-section";
import { speak, stopSpeaking, useSpeechVoices } from "@/lib/speech";

const DICTATION_LANGS = [
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "sw-KE", label: "Kiswahili" },
  { value: "lg-UG", label: "Luganda" },
  { value: "fr-FR", label: "Français" },
  { value: "ar-SA", label: "العربية" },
  { value: "es-ES", label: "Español" },
  { value: "pt-BR", label: "Português (BR)" },
  { value: "de-DE", label: "Deutsch" },
  { value: "hi-IN", label: "हिन्दी" },
  { value: "zh-CN", label: "中文" },
];

export function VoiceSection() {
  const { values, set, reset, resetting, saveState, error, meta, settings } =
    useSection("voice");
  const { voices, ttsSupported, sttSupported } = useSpeechVoices();

  const [previewing, setPreviewing] = useState(false);
  const [micState, setMicState] = useState<
    "unknown" | "checking" | "ok" | "denied" | "unsupported"
  >("unknown");
  const [micDetail, setMicDetail] = useState<string | null>(null);

  useEffect(() => () => stopSpeaking(), []);

  const voiceDisabled = meta?.features?.voice === false;

  function preview() {
    if (previewing) {
      stopSpeaking();
      setPreviewing(false);
      return;
    }
    setPreviewing(true);
    speak(
      "This is how Hetex AI will sound when it reads a reply aloud.",
      values,
      voices,
      () => setPreviewing(false),
      settings.language.voiceOutput
    );
  }

  /**
   * Actually opens the microphone.
   *
   * The only honest way to report whether noise suppression is available: ask
   * for it and read back what the browser granted. Dictation itself goes
   * through the Web Speech API, which does not accept constraints — so this
   * reports on the device, and says so.
   */
  async function checkMicrophone() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicState("unsupported");
      setMicDetail("This browser has no microphone API.");
      return;
    }

    setMicState("checking");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression: values.noiseReduction,
          echoCancellation: values.noiseReduction,
          ...(values.audioQuality === "high" ? { sampleRate: 48000 } : {}),
        },
      });

      const track = stream.getAudioTracks()[0];
      const settings = track?.getSettings?.() ?? {};
      stream.getTracks().forEach((t) => t.stop());

      setMicState("ok");
      setMicDetail(
        [
          track?.label || "Default microphone",
          settings.noiseSuppression === true
            ? "noise suppression on"
            : settings.noiseSuppression === false
              ? "noise suppression not applied"
              : null,
          settings.sampleRate ? `${settings.sampleRate} Hz` : null,
        ]
          .filter(Boolean)
          .join(" · ")
      );
    } catch (err) {
      setMicState("denied");
      setMicDetail(
        err instanceof Error && err.name === "NotAllowedError"
          ? "Permission was refused. Allow microphone access for this site in your browser."
          : "No microphone was available."
      );
    }
  }

  return (
    <>
      <SectionHeader
        title="Voice"
        description="Speaking to Hetex, and hearing it read a reply back."
        onReset={reset}
        resetting={resetting}
      />

      <div className="mb-3 flex justify-end">
        <SaveIndicator state={saveState} error={error} />
      </div>

      <Callout title="Where voice runs">
        Speech recognition and speech synthesis both run in your browser, using
        the voices installed on this device. No audio is ever sent to a Hetex
        server, and none is stored anywhere.
      </Callout>

      {voiceDisabled && (
        <Callout tone="warn" title="Voice is unavailable">
          An administrator has turned voice off for this server.
        </Callout>
      )}

      <SettingsCard
        title="Reading replies aloud"
        description={
          ttsSupported
            ? "Voices come from your device, so this list differs between computers. A saved voice that isn't installed falls back to the default."
            : undefined
        }
      >
        {!ttsSupported && (
          <SettingsRow
            label="Read aloud"
            unavailable="This browser has no speech synthesis, so replies cannot be read aloud here."
          >
            <StatusPill tone="off">Unavailable</StatusPill>
          </SettingsRow>
        )}

        <SettingsRow label="Voice" icon={Volume2} hidden={!ttsSupported}>
          <div className="flex items-center gap-2">
            <SettingsDropdown
              label="Voice"
              value={values.outputVoice ?? ""}
              disabled={voices.length === 0 || voiceDisabled}
              onChange={(v) => set({ outputVoice: v || null })}
              options={[
                { value: "", label: "Device default" },
                ...voices.map((v) => ({
                  value: v.name,
                  label: `${v.name} (${v.lang})`,
                })),
              ]}
            />
            <SettingsButton
              onClick={preview}
              disabled={voices.length === 0 || voiceDisabled}
            >
              {previewing ? <Square size={12} /> : <Play size={12} />}
              {previewing ? "Stop" : "Test"}
            </SettingsButton>
          </div>
        </SettingsRow>

        <SettingsRow label="Speed" hidden={!ttsSupported}>
          <SettingsSlider
            label="Speech speed"
            value={values.rate}
            min={0.5}
            max={2}
            step={0.05}
            disabled={voiceDisabled}
            onCommit={(v) => set({ rate: v })}
            format={(v) => `${v.toFixed(2)}×`}
          />
        </SettingsRow>

        <SettingsRow label="Pitch" hidden={!ttsSupported}>
          <SettingsSlider
            label="Speech pitch"
            value={values.pitch}
            min={0}
            max={2}
            step={0.1}
            disabled={voiceDisabled}
            onCommit={(v) => set({ pitch: v })}
            format={(v) => v.toFixed(1)}
          />
        </SettingsRow>

        <SettingsRow label="Volume" hidden={!ttsSupported}>
          <SettingsSlider
            label="Speech volume"
            value={values.volume}
            min={0}
            max={1}
            step={0.05}
            disabled={voiceDisabled}
            onCommit={(v) => set({ volume: v })}
            format={(v) => `${Math.round(v * 100)}%`}
          />
        </SettingsRow>

        <SettingsRow
          label="Read every reply aloud"
          description="Speaks each answer as it finishes, without you pressing anything."
          hidden={!ttsSupported}
        >
          <SettingsToggle
            label="Read every reply aloud"
            checked={values.autoReadReplies}
            onChange={(v) => set({ autoReadReplies: v })}
            disabled={voiceDisabled}
          />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title="Speaking to Hetex">
        <SettingsRow
          label="Microphone in the composer"
          icon={Mic}
          unavailable={
            sttSupported
              ? undefined
              : "This browser has no speech recognition. Chrome and Edge have it; Firefox and Safari do not."
          }
        >
          <SettingsToggle
            label="Microphone in the composer"
            checked={values.dictationEnabled}
            onChange={(v) => set({ dictationEnabled: v })}
            disabled={!sttSupported || voiceDisabled}
          />
        </SettingsRow>

        <SettingsRow
          label="Speech recognition language"
          description="What language you speak when dictating — not the language of the interface."
        >
          <SettingsDropdown
            label="Speech recognition language"
            value={values.inputLanguage}
            disabled={!sttSupported || values.autoDetectInputLanguage}
            onChange={(v) => set({ inputLanguage: v })}
            options={DICTATION_LANGS}
          />
        </SettingsRow>

        <SettingsRow
          label="Detect the language automatically"
          description="Uses your browser's own language instead of the choice above. Web speech recognition cannot detect a language mid-sentence, so this follows the browser rather than the sound."
        >
          <SettingsToggle
            label="Detect the language automatically"
            checked={values.autoDetectInputLanguage}
            onChange={(v) => set({ autoDetectInputLanguage: v })}
            disabled={!sttSupported}
          />
        </SettingsRow>

        <SettingsRow
          label="Live transcription"
          description="Words appear in the composer as you speak them, rather than only when you stop."
        >
          <SettingsToggle
            label="Live transcription"
            checked={values.liveTranscription}
            onChange={(v) => set({ liveTranscription: v })}
            disabled={!sttSupported}
          />
        </SettingsRow>

        <SettingsRow
          label="Show the transcript"
          description="Displays what was heard before it is sent."
        >
          <SettingsToggle
            label="Show the transcript"
            checked={values.showTranscript}
            onChange={(v) => set({ showTranscript: v })}
            disabled={!sttSupported}
          />
        </SettingsRow>

        <SettingsRow
          label="Let me edit before sending"
          description="Off sends what was heard as soon as you stop talking. On leaves it in the composer to correct."
        >
          <SettingsToggle
            label="Let me edit before sending"
            checked={values.editTranscript}
            onChange={(v) => set({ editTranscript: v })}
            disabled={!sttSupported}
          />
        </SettingsRow>

        <SettingsRow
          label="Send automatically"
          description="Sends as soon as you stop speaking. Ignored while 'Let me edit before sending' is on."
        >
          <SettingsToggle
            label="Send automatically"
            checked={values.autoSubmit}
            onChange={(v) => set({ autoSubmit: v })}
            disabled={!sttSupported || values.editTranscript}
          />
        </SettingsRow>

        <SettingsRow
          label="Microphone behaviour"
          description="Tap starts and stops. Hold listens only while the button is held. Continuous keeps listening until you stop it."
        >
          <SegmentedControl
            label="Microphone behaviour"
            value={values.micMode}
            onChange={(v) => set({ micMode: v })}
            options={[
              { value: "tap", label: "Tap" },
              { value: "hold", label: "Hold" },
              { value: "continuous", label: "Continuous" },
            ]}
            disabled={!sttSupported}
          />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title="Audio">
        <SettingsRow
          label="Noise reduction"
          description="Requested when Hetex opens the microphone. Browser dictation does not accept audio constraints, so this applies to the microphone check below and to live voice."
        >
          <SettingsToggle
            label="Noise reduction"
            checked={values.noiseReduction}
            onChange={(v) => set({ noiseReduction: v })}
          />
        </SettingsRow>

        <SettingsRow label="Audio quality">
          <SegmentedControl
            label="Audio quality"
            value={values.audioQuality}
            onChange={(v) => set({ audioQuality: v })}
            options={[
              { value: "standard", label: "Standard" },
              { value: "high", label: "High" },
            ]}
          />
        </SettingsRow>

        <SettingsRow
          label="Sound effects"
          description="A short tone when listening starts and stops."
        >
          <SettingsToggle
            label="Sound effects"
            checked={values.soundEffects}
            onChange={(v) => set({ soundEffects: v })}
          />
        </SettingsRow>

        <SettingsRow
          label="Haptic feedback"
          description="A brief vibration on devices that have one. Desktop browsers ignore it."
        >
          <SettingsToggle
            label="Haptic feedback"
            checked={values.hapticFeedback}
            onChange={(v) => set({ hapticFeedback: v })}
          />
        </SettingsRow>

        <SettingsRow
          label="Check the microphone"
          description={micDetail ?? "Opens the microphone once and reports what the browser gave back."}
        >
          <div className="flex items-center gap-2">
            {micState === "ok" && <StatusPill tone="ok">Working</StatusPill>}
            {micState === "denied" && <StatusPill tone="off">Blocked</StatusPill>}
            {micState === "unsupported" && (
              <StatusPill tone="off">Unsupported</StatusPill>
            )}
            <SettingsButton
              onClick={checkMicrophone}
              busy={micState === "checking"}
            >
              Test
            </SettingsButton>
          </div>
        </SettingsRow>
      </SettingsCard>
    </>
  );
}
