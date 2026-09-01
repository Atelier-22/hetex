"use client";

// Aviel — the live voice state machine.
//
// Transitions are declared rather than implied. A voice session has enough
// concurrent moving parts — a microphone, a recogniser, a network request and a
// synthesiser, any of which can fail or finish at any moment — that ad-hoc
// setState calls produce states nothing designed for, like SPEAKING with the
// microphone still open.
//
// Anything not listed here cannot happen, and an attempted illegal transition
// is reported rather than silently applied.

export type VoiceState =
  | "idle"
  | "connecting"
  | "listening"
  | "processing"
  | "speaking"
  | "interrupted"
  | "paused"
  | "error"
  | "offline";

export const VOICE_TRANSITIONS: Record<VoiceState, VoiceState[]> = {
  // Nothing is running. Everything starts here and returns here.
  idle: ["connecting", "offline", "error"],

  // Opening the microphone and waiting on permission.
  connecting: ["listening", "error", "offline", "idle"],

  // The microphone is open and the recogniser is running.
  listening: ["processing", "paused", "idle", "error", "offline"],

  // The turn has been sent and a reply is being generated.
  processing: ["speaking", "listening", "idle", "error", "offline"],

  // Reading the reply aloud.
  speaking: ["interrupted", "listening", "idle", "paused", "error", "offline"],

  // The user talked over the reply. A staging state, held only long enough to
  // stop the synthesiser before listening resumes.
  interrupted: ["listening", "idle", "error"],

  // Microphone muted, session still open.
  paused: ["listening", "idle", "offline"],

  // Recoverable. Retrying goes back through connecting.
  error: ["idle", "connecting", "offline"],

  // No network. Nothing can be sent, so nothing but idle or reconnect.
  offline: ["idle", "connecting"],
};

export function canTransition(from: VoiceState, to: VoiceState): boolean {
  if (from === to) return true;
  return VOICE_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Copy for each state. Kept here so the screen never invents its own wording. */
export const VOICE_COPY: Record<
  VoiceState,
  { label: string; hint: string; tone: "neutral" | "live" | "warn" | "bad" }
> = {
  idle: { label: "Tap to talk", hint: "I'm here, ready when you are.", tone: "neutral" },
  connecting: { label: "Connecting…", hint: "Opening your microphone.", tone: "neutral" },
  listening: { label: "Listening…", hint: "Speak naturally, I can hear you.", tone: "live" },
  processing: { label: "Thinking…", hint: "Working on your answer.", tone: "live" },
  speaking: { label: "Speaking…", hint: "Talk over me to interrupt.", tone: "live" },
  interrupted: { label: "Go ahead", hint: "I stopped — I'm listening.", tone: "live" },
  paused: { label: "Paused", hint: "Your microphone is off. The session is still open.", tone: "warn" },
  error: { label: "Something went wrong", hint: "", tone: "bad" },
  offline: { label: "Offline", hint: "No connection, so nothing can be sent.", tone: "bad" },
};

/**
 * Which colour family the orb and waveform use.
 *
 * Blue while the user is the active party, orange while Aviel is. That is the
 * one thing a glance at the screen should tell you, so it is derived from the
 * state rather than set at each call site.
 */
export function voicePalette(state: VoiceState): "blue" | "orange" | "mixed" | "dim" {
  switch (state) {
    case "listening":
    case "interrupted":
      return "blue";
    case "speaking":
      return "orange";
    case "processing":
      return "mixed";
    default:
      return "dim";
  }
}
