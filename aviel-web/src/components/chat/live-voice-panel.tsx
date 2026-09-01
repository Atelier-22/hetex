"use client";

// Aviel AI — live voice.
//
// A real hands-free loop, composed from pieces that already exist: the
// browser's speech recognition produces text, that text goes through the same
// /chat endpoint as a typed message, and the browser's speech synthesis reads
// the reply back. Then it listens again.
//
// Everything the Live Voice settings describe is read here, so each of those
// controls changes what this component does. Nothing is recorded and no audio
// leaves the device — the microphone feeds the browser's own recogniser and
// nothing else.

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Mic, MicOff, Radio, Square, X } from "lucide-react";
import { useSettingsStore } from "@/lib/settings/store";
import { apiStream } from "@/lib/api-client";
import {
  getSpeechRecognition,
  haptic,
  playCue,
  recognitionLanguage,
  speak,
  stopSpeaking,
  useSpeechVoices,
  type SpeechRecognitionLike,
} from "@/lib/speech";

export type LiveState =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "muted"
  | "offline"
  | "error";

const STATE_COPY: Record<LiveState, { label: string; hint: string }> = {
  idle: { label: "Ready", hint: "Tap the microphone to start talking." },
  listening: { label: "Listening", hint: "Go ahead — I'm listening." },
  thinking: { label: "Thinking", hint: "Working on your answer." },
  speaking: { label: "Speaking", hint: "Talk over me to interrupt." },
  muted: { label: "Muted", hint: "The microphone is off. The session is still open." },
  offline: { label: "Offline", hint: "No connection, so nothing can be sent." },
  error: { label: "Something went wrong", hint: "" },
};

type Turn = { role: "user" | "assistant"; text: string };

export function LiveVoicePanel({
  conversationId,
  onClose,
  onTurn,
}: {
  conversationId?: string;
  onClose: () => void;
  /** Lets the chat window show the same messages in the transcript. */
  onTurn?: (turn: Turn) => void;
}) {
  const { settings } = useSettingsStore();
  const { voices } = useSpeechVoices();

  const live = settings.liveVoice;
  const voice = settings.voice;

  const [state, setState] = useState<LiveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [interim, setInterim] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [muted, setMuted] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const stateRef = useRef<LiveState>("idle");
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const setLiveState = useCallback((next: LiveState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setInterim("");
  }, []);

  /** Ends everything: recognition, synthesis and any in-flight request. */
  const endSession = useCallback(() => {
    stopListening();
    stopSpeaking();
    abortRef.current?.abort();
    setLiveState("idle");
  }, [stopListening, setLiveState]);

  // Connectivity, read rather than assumed.
  useEffect(() => {
    const read = () => {
      if (!navigator.onLine) {
        endSession();
        setLiveState("offline");
      } else if (stateRef.current === "offline") {
        setLiveState("idle");
      }
    };
    read();
    window.addEventListener("online", read);
    window.addEventListener("offline", read);
    return () => {
      window.removeEventListener("online", read);
      window.removeEventListener("offline", read);
    };
  }, [endSession, setLiveState]);

  // The session ends by itself, so a forgotten open microphone does not stay
  // open indefinitely.
  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => {
      const seconds = Math.floor((Date.now() - started) / 1000);
      setElapsed(seconds);
      if (seconds >= live.maxSessionMinutes * 60) {
        endSession();
        setError(
          `The session ended after ${live.maxSessionMinutes} minutes, which is the maximum length in Settings.`
        );
        setLiveState("error");
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [live.maxSessionMinutes, endSession, setLiveState]);

  useEffect(() => endSession, [endSession]);

  const speakReply = useCallback(
    (text: string) => {
      setLiveState("speaking");
      speak(
        text,
        settingsRef.current.voice,
        voices,
        () => {
        if (stateRef.current !== "speaking") return;
        if (settingsRef.current.liveVoice.continuousListening && !muted) {
          startListeningRef.current?.();
        } else {
          setLiveState("idle");
        }
        },
        settingsRef.current.language.voiceOutput
      );
    },
    [voices, muted, setLiveState]
  );

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      setTurns((prev) => [...prev, { role: "user", text: trimmed }]);
      onTurn?.({ role: "user", text: trimmed });
      setLiveState("thinking");
      setError(null);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await apiStream(
          "/chat",
          {
            message: trimmed,
            conversationId,
            webSearchEnabled: false,
            // "Save the transcript" off means this session leaves nothing
            // behind, which is the same mechanism as chat history being off.
            excludeFromMemory: !settingsRef.current.liveVoice.saveTranscript,
          },
          controller.signal
        );

        if (!res.body) throw new Error("No response stream from the server");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let full = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";

          for (const raw of events) {
            const eventLine = raw.split("\n").find((l) => l.startsWith("event: "));
            const dataLine = raw.split("\n").find((l) => l.startsWith("data: "));
            if (!eventLine || !dataLine) continue;

            const type = eventLine.replace("event: ", "");
            const data = JSON.parse(dataLine.replace("data: ", ""));

            if (type === "chunk") full += data.text;
            else if (type === "error") throw new Error(data.message);
          }
        }

        if (!full.trim()) throw new Error("No reply came back.");

        setTurns((prev) => [...prev, { role: "assistant", text: full }]);
        onTurn?.({ role: "assistant", text: full });
        speakReply(full);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Something went wrong.");
        setLiveState("error");
      }
    },
    [conversationId, onTurn, speakReply, setLiveState]
  );

  const startListening = useCallback(() => {
    const Recognition = getSpeechRecognition();
    if (!Recognition) {
      setError("This browser has no speech recognition.");
      setLiveState("error");
      return;
    }
    if (!navigator.onLine) {
      setLiveState("offline");
      return;
    }

    const l = settingsRef.current.liveVoice;
    const v = settingsRef.current.voice;

    stopListening();

    const recognition = new Recognition();
    recognition.lang = recognitionLanguage(v);
    // Voice-activity detection is what the recogniser's own end-of-speech
    // signal gives us. With it off, listening runs until you stop it by hand.
    recognition.continuous = !l.voiceActivityDetection;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    let finalText = "";

    recognition.onstart = () => {
      setLiveState("listening");
      playCue("start", v);
      haptic(v);
    };

    recognition.onresult = (event) => {
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else interimText += result[0].transcript;
      }
      setInterim(interimText);

      // Aviel may start answering on a partial phrase when the account has
      // said it may interrupt. Otherwise it waits for the recogniser to
      // decide the sentence is over.
      if (l.allowAiInterruption && interimText.trim().length > 40) {
        recognition.stop();
      }
    };

    recognition.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      setError(
        event.error === "not-allowed"
          ? "Microphone access was refused. Allow it for this site to use live voice."
          : `Speech recognition failed (${event.error}).`
      );
      setLiveState("error");
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      setInterim("");
      playCue("stop", v);

      const text = finalText.trim();
      if (!text) {
        // Nothing was heard. Keep the loop alive rather than ending silently.
        if (stateRef.current === "listening") {
          if (l.continuousListening && !muted) startListeningRef.current?.();
          else setLiveState("idle");
        }
        return;
      }

      if (l.autoResponse) void send(text);
      else {
        setTurns((prev) => [...prev, { role: "user", text }]);
        setLiveState("idle");
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [muted, send, stopListening, setLiveState]);

  // Held in a ref because the callbacks above are created before it exists.
  const startListeningRef = useRef<() => void>();
  startListeningRef.current = startListening;

  /**
   * Talking over Aviel stops it and hands the turn back.
   *
   * Implemented as a click rather than by listening while speaking: a
   * microphone open during synthesis hears the speakers, and the browser gives
   * no echo cancellation for that path.
   */
  function interrupt() {
    if (!live.allowInterrupt) return;
    stopSpeaking();
    startListening();
  }

  function toggleMute() {
    setMuted((m) => {
      const next = !m;
      if (next) {
        stopListening();
        setLiveState("muted");
      } else {
        startListening();
      }
      return next;
    });
  }

  const copy = STATE_COPY[state];
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  return (
    <div
      className="settings-card mb-3 px-4 py-4"
      role="region"
      aria-label="Live voice"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${
              state === "listening"
                ? "border-accent text-accent animate-pulse"
                : state === "error" || state === "offline"
                  ? "border-aviel-red-500 text-aviel-red-500"
                  : "border-[var(--border-subtle)] text-[var(--text-secondary)]"
            }`}
          >
            {state === "thinking" ? (
              <Loader2 size={18} className="animate-spin" />
            ) : state === "muted" ? (
              <MicOff size={18} />
            ) : (
              <Radio size={18} />
            )}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold" aria-live="polite">
              {copy.label}
            </p>
            <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
              {error ?? copy.hint}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <span className="font-mono text-xs tabular-nums text-[var(--text-secondary)]">
            {minutes}:{String(seconds).padStart(2, "0")}
          </span>
          <button
            onClick={onClose}
            aria-label="Close live voice"
            className="focus-ring rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {live.showTranscript && (interim || turns.length > 0) && (
        <div className="mt-3 max-h-40 overflow-y-auto rounded-lg border border-[var(--border-subtle)] p-2.5">
          {turns.slice(-6).map((t, i) => (
            <p
              key={`${t.role}-${i}`}
              className={`text-xs leading-relaxed ${
                t.role === "user"
                  ? "text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)]"
              }`}
            >
              <span className="font-medium">
                {t.role === "user" ? "You: " : "Aviel: "}
              </span>
              {t.text}
            </p>
          ))}
          {interim && (
            <p className="text-xs italic text-[var(--text-secondary)]">{interim}</p>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {state === "speaking" && live.allowInterrupt && (
          <button
            onClick={interrupt}
            className="focus-ring rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-sm hover:bg-[var(--surface-hover)]"
          >
            Interrupt
          </button>
        )}

        {(state === "idle" || state === "error") && (
          <button
            onClick={startListening}
            className="bg-accent-gradient focus-ring flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white"
          >
            <Mic size={14} /> Start listening
          </button>
        )}

        {state === "listening" && (
          <button
            onClick={() => recognitionRef.current?.stop()}
            className="focus-ring flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-sm hover:bg-[var(--surface-hover)]"
          >
            <Square size={13} /> Done speaking
          </button>
        )}

        {state !== "offline" && (
          <button
            onClick={toggleMute}
            aria-pressed={muted}
            className="focus-ring flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-sm hover:bg-[var(--surface-hover)]"
          >
            {muted ? <Mic size={14} /> : <MicOff size={14} />}
            {muted ? "Unmute" : "Mute"}
          </button>
        )}

        <button
          onClick={() => {
            endSession();
            onClose();
          }}
          className="focus-ring rounded-lg px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
        >
          End session
        </button>
      </div>

      {!live.saveTranscript && (
        <p className="mt-2.5 text-[11px] leading-relaxed text-[var(--text-secondary)]">
          This session is not being added to your memory. Whether the
          conversation itself is kept follows your chat history setting.
        </p>
      )}
    </div>
  );
}
