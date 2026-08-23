"use client";

import { useEffect, useState } from "react";
import { Mic, Volume2, Play } from "lucide-react";
import {
  SectionHeader,
  SettingsRow,
  SettingsToggle,
  SettingsDropdown,
  SettingsButton,
  SaveIndicator,
  NotWiredBadge,
} from "../primitives";
import { usePreferences } from "../../preferences";
import { useSave } from "../use-save";

const DICTATION_LANGS = [
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "sw-KE", label: "Kiswahili" },
  { value: "fr-FR", label: "Français" },
  { value: "ar-SA", label: "العربية" },
];

export function VoiceSection() {
  const { prefs, update } = usePreferences();
  const { state, error, run } = useSave();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [sttSupported, setSttSupported] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setSttSupported(
      Boolean(
        (window as any).SpeechRecognition ||
          (window as any).webkitSpeechRecognition
      )
    );

    if (!("speechSynthesis" in window)) return;
    // Voices load asynchronously — the first call routinely returns an empty
    // array and the event is the only reliable signal.
    const read = () => setVoices(window.speechSynthesis.getVoices());
    read();
    window.speechSynthesis.addEventListener("voiceschanged", read);
    return () =>
      window.speechSynthesis.removeEventListener("voiceschanged", read);
  }, []);

  function preview() {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(
      "This is how Hetex AI will sound when reading a reply aloud."
    );
    const voice = voices.find((v) => v.name === prefs.voiceName);
    if (voice) u.voice = voice;
    window.speechSynthesis.speak(u);
  }

  return (
    <>
      <SectionHeader
        title="Voice"
        description="Speaking to Hetex, and having it read replies back."
      />

      <div className="mb-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-3">
        <NotWiredBadge>No voice mode</NotWiredBadge>
        <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
          Hetex has no live voice conversation mode. What works today uses your
          browser: dictation types into the composer, and Read Aloud speaks a
          reply from the actions under it. Both stay on your device — no audio
          is sent to a server.
        </p>
      </div>

      <div className="flex justify-end pb-1">
        <SaveIndicator state={state} />
      </div>

      <SettingsRow
        label="Dictation"
        icon={Mic}
        description={
          sttSupported
            ? "Shows a microphone in the composer."
            : "Your browser has no speech recognition. Chrome and Edge do; Firefox and Safari do not."
        }
      >
        <SettingsToggle
          label="Dictation"
          checked={prefs.dictationEnabled}
          disabled={!sttSupported}
          onChange={(v) => run(() => update({ dictationEnabled: v }))}
        />
      </SettingsRow>

      <SettingsRow
        label="Dictation language"
        description="What language you speak when dictating — not what language the interface is in."
      >
        <SettingsDropdown
          label="Dictation language"
          value={prefs.voiceInputLang ?? "en-US"}
          disabled={!sttSupported}
          onChange={(v) => run(() => update({ voiceInputLang: v }))}
          options={DICTATION_LANGS}
        />
      </SettingsRow>

      <SettingsRow
        label="Read Aloud voice"
        icon={Volume2}
        description={
          voices.length === 0
            ? "Your browser reports no speech voices, so Read Aloud is unavailable here."
            : "Voices come from your device, so this list differs between computers. A saved voice that isn't installed falls back to the default."
        }
      >
        <div className="flex items-center gap-2">
          <SettingsDropdown
            label="Read Aloud voice"
            value={prefs.voiceName ?? ""}
            disabled={voices.length === 0}
            onChange={(v) => run(() => update({ voiceName: v || null }))}
            options={[
              { value: "", label: "Browser default" },
              ...voices.map((v) => ({
                value: v.name,
                label: `${v.name} (${v.lang})`,
              })),
            ]}
          />
          <SettingsButton onClick={preview} disabled={voices.length === 0}>
            <Play size={12} /> Test
          </SettingsButton>
        </div>
      </SettingsRow>

      {error && <p className="mt-4 text-xs text-hetex-red-500">{error}</p>}
    </>
  );
}
