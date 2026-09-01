"use client";

// Aviel AI — browser speech.
//
// One place that reads the voice settings and applies them, so "Read aloud" in
// a message, the preview button in Settings, and live voice all sound the same.
// Everything here runs on the device: the Web Speech API never sends audio to a
// Aviel server, which is what lets the Voice screen say so plainly.

import { useEffect, useState } from "react";
import type { UserSettings } from "./settings/types";

type VoiceSettings = UserSettings["voice"];

export function ttsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function sttSupported(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as Record<string, unknown>;
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

/** The SpeechRecognition constructor, whatever this browser calls it. */
export function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as
    | (new () => SpeechRecognitionLike)
    | null;
}

/**
 * The bits of SpeechRecognition this app uses.
 *
 * Typed here rather than pulled from lib.dom: the interface is still
 * vendor-prefixed in most browsers and is not in TypeScript's DOM types.
 */
export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult:
    | ((event: {
        resultIndex: number;
        results: {
          length: number;
          [index: number]: { isFinal: boolean; 0: { transcript: string } };
        };
      }) => void)
    | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
}

/**
 * The installed voices.
 *
 * They load asynchronously — the first call routinely returns an empty array,
 * and the event is the only reliable signal that the list is ready.
 */
export function useSpeechVoices() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [supported, setSupported] = useState({ tts: false, stt: false });

  useEffect(() => {
    setSupported({ tts: ttsSupported(), stt: sttSupported() });
    if (!ttsSupported()) return;

    const read = () => setVoices(window.speechSynthesis.getVoices());
    read();
    window.speechSynthesis.addEventListener("voiceschanged", read);
    return () =>
      window.speechSynthesis.removeEventListener("voiceschanged", read);
  }, []);

  return { voices, ttsSupported: supported.tts, sttSupported: supported.stt };
}

/**
 * Speak, with the account's chosen voice, speed, pitch and volume.
 *
 * A saved voice may not exist on this device — voices are installed per
 * machine, so falling through to the browser default is the right behaviour
 * rather than failing to speak at all.
 */
export function speak(
  text: string,
  settings: VoiceSettings,
  voices: SpeechSynthesisVoice[],
  onEnd?: () => void,
  /** Settings → Language → Voice output. "auto" follows the chosen voice. */
  preferredLanguage?: string
): void {
  if (!ttsSupported() || !text.trim()) {
    onEnd?.();
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = settings.rate;
  utterance.pitch = settings.pitch;
  utterance.volume = settings.volume;

  const voice = pickVoice(settings, voices, preferredLanguage);
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  }

  utterance.onend = () => onEnd?.();
  utterance.onerror = () => onEnd?.();
  window.speechSynthesis.speak(utterance);
}

/**
 * Which installed voice to use.
 *
 * A named voice wins, because it was chosen explicitly. Failing that, the
 * output language picks the first voice for that language. A device with
 * neither falls through to the browser default rather than staying silent —
 * voices are installed per machine, so a saved choice may simply not exist here.
 */
export function pickVoice(
  settings: VoiceSettings,
  voices: SpeechSynthesisVoice[],
  preferredLanguage?: string
): SpeechSynthesisVoice | null {
  if (settings.outputVoice) {
    const named = voices.find((v) => v.name === settings.outputVoice);
    if (named) return named;
  }

  if (preferredLanguage && preferredLanguage !== "auto") {
    const base = preferredLanguage.split("-")[0].toLowerCase();
    const match = voices.find((v) => v.lang.toLowerCase().startsWith(base));
    if (match) return match;
  }

  return null;
}

export function stopSpeaking(): void {
  if (ttsSupported()) window.speechSynthesis.cancel();
}

/** The recognition language, honouring "detect automatically". */
export function recognitionLanguage(settings: VoiceSettings): string {
  if (settings.autoDetectInputLanguage && typeof navigator !== "undefined") {
    return navigator.language || settings.inputLanguage;
  }
  return settings.inputLanguage;
}

/**
 * A short tone, when sound effects are on.
 *
 * Synthesised with the Web Audio API rather than shipped as an asset — it is
 * two oscillator envelopes, and an audio file would be a network request for
 * something the browser can make.
 */
export function playCue(kind: "start" | "stop", settings: VoiceSettings): void {
  if (!settings.soundEffects || typeof window === "undefined") return;

  const AudioCtx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) return;

  try {
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.value = kind === "start" ? 660 : 440;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.16);

    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.18);
    // Closing releases the audio hardware; leaving contexts open exhausts the
    // browser's limit after a few dozen cues.
    osc.onended = () => void ctx.close();
  } catch {
    // Autoplay policy, or no audio device. A missing beep is not an error.
  }
}

/** A brief vibration, on devices that have one. */
export function haptic(settings: { hapticFeedback: boolean }, ms = 15): void {
  if (!settings.hapticFeedback) return;
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate(ms);
  } catch {
    // Blocked by the browser. Nothing to report.
  }
}
