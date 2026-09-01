"use client";

// Aviel — live voice.
//
// The real loop: microphone opens once, the recogniser runs continuously,
// voice-activity detection decides when a turn has ended, the turn goes through
// the same /chat endpoint as a typed message, and the reply is spoken back.
// Then it listens again, without the user pressing anything.
//
// Interruption is real: while Aviel is speaking the analyser keeps running, and
// sustained speech over it cancels the utterance and hands the turn back.
//
// What is honestly not possible here, stated rather than faked: speechSynthesis
// exposes no audio stream, so the orb cannot react to the *amplitude* of Aviel's
// voice. It reacts instead to the synthesiser's own word-boundary events, which
// are real per-word signals from the real utterance. See VoiceWaveform.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  Loader2,
  Mic,
  MicOff,
  Settings2,
  Sparkles,
  X,
} from "lucide-react";
import { useSettingsStore } from "@/lib/settings/store";
import { apiFetch, apiStream } from "@/lib/api-client";
import {
  getSpeechRecognition,
  haptic,
  pickVoice,
  playCue,
  recognitionLanguage,
  stopSpeaking,
  useSpeechVoices,
  type SpeechRecognitionLike,
} from "@/lib/speech";
import { AudioEngine } from "@/lib/voice/audio-engine";
import {
  VOICE_COPY,
  canTransition,
  type VoiceState,
} from "@/lib/voice/voice-state";
import { VoiceOrb } from "./voice-orb";
import { VoiceWaveform } from "./voice-waveform";

type Turn = { id: string; role: "user" | "assistant"; text: string };

type SessionType = { id: string; label: string; description: string };

export function LiveVoiceScreen({
  conversationId,
  sessionId,
  onExit,
}: {
  conversationId?: string;
  sessionId?: string;
  onExit: () => void;
}) {
  const router = useRouter();
  const { settings, meta } = useSettingsStore();
  const { voices } = useSpeechVoices();

  const [state, setStateRaw] = useState<VoiceState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [interim, setInterim] = useState("");
  const [showTranscript, setShowTranscript] = useState(
    settings.liveVoice.showTranscript
  );
  const [showSettings, setShowSettings] = useState(false);
  const [sessionTypes, setSessionTypes] = useState<SessionType[]>([]);
  const [sessionType, setSessionType] = useState("chat");
  const [elapsed, setElapsed] = useState(0);
  const [online, setOnline] = useState(true);

  // Read by the animation loops every frame. Deliberately refs: a setState per
  // frame would re-render the tree sixty times a second.
  const levelRef = useRef(0);
  const binsRef = useRef<Float32Array>(new Float32Array(256));
  const speechEnergyRef = useRef(0);

  const engineRef = useRef<AudioEngine | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const stateRef = useRef<VoiceState>("idle");
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const finalRef = useRef("");
  const convRef = useRef(conversationId);
  const interruptRaf = useRef(0);

  const reducedMotion =
    settings.accessibility.reduceMotion || settings.appearance.animations === "off";

  /** The only way state changes. Illegal transitions are refused, not applied. */
  const setState = useCallback((next: VoiceState) => {
    const from = stateRef.current;
    if (!canTransition(from, next)) {
      if (settingsRef.current.advanced.debugMode) {
        console.warn(`[Aviel] refused voice transition ${from} → ${next}`);
      }
      return;
    }
    stateRef.current = next;
    setStateRaw(next);
  }, []);

  /* ---- Connectivity ---- */
  useEffect(() => {
    const read = () => {
      const on = navigator.onLine;
      setOnline(on);
      if (!on) setState("offline");
      else if (stateRef.current === "offline") setState("idle");
    };
    read();
    window.addEventListener("online", read);
    window.addEventListener("offline", read);
    return () => {
      window.removeEventListener("online", read);
      window.removeEventListener("offline", read);
    };
  }, [setState]);

  /* ---- Session types, from the server ---- */
  useEffect(() => {
    apiFetch<SessionType[]>("/sessions/types")
      .then(setSessionTypes)
      .catch(() => setSessionTypes([]));
  }, []);

  /* ---- Session clock ---- */
  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => {
      const secs = Math.floor((Date.now() - started) / 1000);
      setElapsed(secs);
      if (secs >= settingsRef.current.liveVoice.maxSessionMinutes * 60) {
        end("The session reached its maximum length.");
      }
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- Teardown ---- */
  const teardown = useCallback(() => {
    if (interruptRaf.current) cancelAnimationFrame(interruptRaf.current);
    interruptRaf.current = 0;
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    abortRef.current?.abort();
    stopSpeaking();
    engineRef.current?.stop();
    engineRef.current = null;
    levelRef.current = 0;
    speechEnergyRef.current = 0;
  }, []);

  useEffect(() => teardown, [teardown]);

  const end = useCallback(
    (reason?: string) => {
      teardown();
      stateRef.current = "idle";
      setStateRaw("idle");
      if (reason) setError(reason);
    },
    [teardown]
  );

  /* ---- Speaking ---------------------------------------------------------
     Boundary events are the only real per-word signal the synthesiser gives,
     so they drive the orb while Aviel talks. */
  const speakReply = useCallback(
    (text: string) => {
      const v = settingsRef.current.voice;

      if (!settingsRef.current.liveVoice.autoResponse || typeof window === "undefined") {
        setState("listening");
        return;
      }
      if (!("speechSynthesis" in window)) {
        // No synthesiser: the reply is still on screen, so the session
        // continues rather than dead-ending.
        setState("listening");
        startListening();
        return;
      }

      setState("speaking");
      window.speechSynthesis.cancel();

      const u = new SpeechSynthesisUtterance(text);
      u.rate = v.rate;
      u.pitch = v.pitch;
      u.volume = v.volume;
      const voice = pickVoice(v, voices, settingsRef.current.language.voiceOutput);
      if (voice) {
        u.voice = voice;
        u.lang = voice.lang;
      }

      // Each word spoken bumps the energy; it decays between words, which is
      // what gives the orb its cadence.
      u.onboundary = () => {
        speechEnergyRef.current = 1;
      };

      const decay = () => {
        speechEnergyRef.current *= 0.9;
        if (stateRef.current === "speaking") requestAnimationFrame(decay);
      };
      requestAnimationFrame(decay);

      const done = () => {
        speechEnergyRef.current = 0;
        if (stateRef.current !== "speaking") return;
        if (settingsRef.current.liveVoice.continuousListening) {
          setState("listening");
          startListening();
        } else {
          setState("idle");
        }
      };

      u.onend = done;
      u.onerror = done;
      window.speechSynthesis.speak(u);

      // Interruption watch: the analyser keeps running while Aviel talks, and
      // sustained speech over it hands the turn back.
      if (settingsRef.current.liveVoice.allowInterrupt) {
        let loudFrames = 0;
        const watch = () => {
          if (stateRef.current !== "speaking") return;
          interruptRaf.current = requestAnimationFrame(watch);
          if (engineRef.current?.isLoud()) {
            loudFrames++;
            // ~200ms of sustained sound. Echo cancellation removes most of
            // Aviel's own voice, and this clears what it does not.
            if (loudFrames > 12) {
              loudFrames = 0;
              window.speechSynthesis.cancel();
              speechEnergyRef.current = 0;
              setState("interrupted");
              haptic(settingsRef.current.voice);
              setState("listening");
              startListening();
            }
          } else {
            loudFrames = Math.max(0, loudFrames - 1);
          }
        };
        interruptRaf.current = requestAnimationFrame(watch);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [voices, setState]
  );

  /* ---- Sending a turn ---- */
  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        setState("listening");
        startListening();
        return;
      }

      setTurns((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "user", text: trimmed },
      ]);
      setInterim("");
      setState("processing");
      setError(null);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await apiStream(
          "/chat",
          {
            message: trimmed,
            conversationId: convRef.current,
            webSearchEnabled: false,
            excludeFromMemory: !settingsRef.current.liveVoice.saveTranscript,
          },
          controller.signal
        );

        if (!res.body) throw new Error("No response stream from the server.");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let full = "";
        const id = crypto.randomUUID();

        setTurns((prev) => [...prev, { id, role: "assistant", text: "" }]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";

          for (const raw of events) {
            const ev = raw.split("\n").find((l) => l.startsWith("event: "));
            const dl = raw.split("\n").find((l) => l.startsWith("data: "));
            if (!ev || !dl) continue;
            const type = ev.replace("event: ", "");
            const data = JSON.parse(dl.replace("data: ", ""));

            if (type === "meta" && data.conversationId) {
              convRef.current = data.conversationId;
            } else if (type === "chunk") {
              full += data.text;
              // Streamed into the transcript as it arrives, per the brief.
              setTurns((prev) =>
                prev.map((t) => (t.id === id ? { ...t, text: full } : t))
              );
            } else if (type === "error") {
              throw new Error(data.message);
            }
          }
        }

        if (!full.trim()) throw new Error("No reply came back.");
        speakReply(full);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Something went wrong.");
        setState("error");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setState, speakReply]
  );

  /* ---- Listening ---- */
  const startListening = useCallback(() => {
    const Recognition = getSpeechRecognition();
    if (!Recognition) {
      setError("This browser has no speech recognition. Chrome and Edge have it.");
      setState("error");
      return;
    }
    if (!navigator.onLine) {
      setState("offline");
      return;
    }

    recognitionRef.current?.abort();
    finalRef.current = "";

    const v = settingsRef.current.voice;
    const recognition = new Recognition();
    recognition.lang = recognitionLanguage(v);
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) finalRef.current += r[0].transcript;
        else interimText += r[0].transcript;
      }
      setInterim(interimText);
    };

    recognition.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      setError(
        event.error === "not-allowed"
          ? "Microphone access was refused. Allow it for this site to use voice."
          : "I couldn't hear that."
      );
      setState("error");
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      // The recogniser stops on its own after a pause. If we are still meant
      // to be listening, restart it — that is what makes the session
      // continuous rather than one-shot.
      if (stateRef.current === "listening") {
        const text = finalRef.current.trim();
        if (text) void send(text);
        else startListening();
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      engineRef.current?.setMuted(false);
      playCue("start", v);
    } catch {
      // start() throws if called while already running; the existing session
      // is the one we want, so this is not an error.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [send, setState]);

  /* ---- Starting the session ---- */
  const begin = useCallback(async () => {
    setError(null);
    setState("connecting");

    const engine = new AudioEngine();
    engineRef.current = engine;

    const status = await engine.start({
      noiseReduction: settingsRef.current.voice.noiseReduction,
      highQuality: settingsRef.current.voice.audioQuality === "high",
      silenceMs: settingsRef.current.liveVoice.voiceActivityDetection ? 900 : 4000,
      onSpeechEnd: () => {
        // Voice-activity detection is what ends a turn without a button.
        if (stateRef.current !== "listening") return;
        if (!settingsRef.current.liveVoice.voiceActivityDetection) return;
        recognitionRef.current?.stop();
      },
    });

    if (status !== "running") {
      setError(
        engine.error ??
          "The microphone could not be opened."
      );
      setState("error");
      return;
    }

    // The loops read these refs directly; assigning the arrays once avoids a
    // copy per frame.
    binsRef.current = engine.bins;

    const pump = () => {
      if (!engineRef.current) return;
      levelRef.current = engineRef.current.level;
      requestAnimationFrame(pump);
    };
    requestAnimationFrame(pump);

    setState("listening");
    startListening();
  }, [setState, startListening]);

  const pause = useCallback(() => {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    engineRef.current?.setMuted(true);
    stopSpeaking();
    setState("paused");
  }, [setState]);

  const resume = useCallback(() => {
    engineRef.current?.setMuted(false);
    setState("listening");
    startListening();
  }, [setState, startListening]);

  const copy = VOICE_COPY[state];
  const busy = state === "connecting" || state === "processing";
  const activeSession =
    sessionTypes.find((s) => s.id === sessionType) ?? sessionTypes[0];

  const localOnly =
    settings.privacy.localOnly || meta?.localAI?.available === true;
  const engineLabel = settings.privacy.localOnly
    ? "Aviel Local AI"
    : online
      ? "Aviel Online"
      : "Offline";

  return (
    <div className="voice-screen">
      {/* ---- Header ---- */}
      <header className="voice-header">
        <button
          type="button"
          onClick={() => { end(); onExit(); }}
          aria-label="Leave voice mode"
          className="voice-icon-btn"
        >
          <ChevronDown size={20} />
        </button>

        <div className="min-w-0 text-center">
          <p className="text-[15px] font-semibold">Aviel Voice</p>
          <p className="flex items-center justify-center gap-1.5 text-[11px] text-[var(--voice-dim)]">
            <span
              className={`voice-dot ${online ? "voice-dot--on" : "voice-dot--off"}`}
              aria-hidden
            />
            {engineLabel}
            <span aria-hidden>·</span>
            <span className="tabular-nums">
              {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
            </span>
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowSettings((v) => !v)}
          aria-label="Voice settings"
          aria-expanded={showSettings}
          className="voice-icon-btn"
        >
          <Settings2 size={19} />
        </button>
      </header>

      {/* ---- Stage ---- */}
      <div className="voice-stage">
        <p className="voice-greeting">
          {turns.length === 0
            ? "Hi, I'm Aviel. How can I help you?"
            : activeSession?.label
              ? `${activeSession.label} session`
              : ""}
        </p>

        <div className="voice-orb-wrap">
          <VoiceOrb
            state={state}
            levelRef={levelRef}
            size={280}
            reducedMotion={reducedMotion}
          />
        </div>

        <VoiceWaveform
          state={state}
          binsRef={binsRef}
          speechEnergyRef={speechEnergyRef}
          width={320}
          height={52}
          reducedMotion={reducedMotion}
          className="voice-wave"
        />

        <p
          className={`voice-status voice-status--${copy.tone}`}
          role="status"
          aria-live="polite"
        >
          {busy && <Loader2 size={14} className="animate-spin" />}
          {error && state === "error" ? "I couldn't hear that." : copy.label}
        </p>
        <p className="voice-hint">{error ?? copy.hint}</p>

        {error && state === "error" && (
          <button type="button" onClick={begin} className="voice-retry">
            Try again
          </button>
        )}

        {/* ---- Transcript ---- */}
        {showTranscript && turns.length > 0 && (
          <div className="voice-transcript" aria-live="polite">
            {turns.slice(-6).map((t) => (
              <p key={t.id} className={`voice-turn voice-turn--${t.role}`}>
                <span className="voice-turn-who">
                  {t.role === "user" ? "You" : "Aviel"}
                </span>
                {t.text}
              </p>
            ))}
            {interim && <p className="voice-turn voice-turn--interim">{interim}</p>}
          </div>
        )}
      </div>

      {/* ---- Controls ---- */}
      <div className="voice-controls">
        <button
          type="button"
          onClick={() => setShowTranscript((v) => !v)}
          className="voice-side-btn"
          aria-pressed={showTranscript}
        >
          <Sparkles size={19} />
          <span>Transcript</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (state === "idle" || state === "error") return void begin();
            if (state === "paused") return resume();
            return pause();
          }}
          disabled={state === "offline"}
          aria-label={
            state === "idle" || state === "error"
              ? "Start talking"
              : state === "paused"
                ? "Resume"
                : "Pause"
          }
          className={`voice-main-btn voice-main-btn--${state}`}
        >
          {state === "paused" ? (
            <MicOff size={26} />
          ) : state === "idle" || state === "error" ? (
            <Mic size={26} />
          ) : (
            <span className="voice-main-wave" aria-hidden>
              <i /><i /><i /><i /><i />
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => { end(); onExit(); }}
          className="voice-side-btn"
        >
          <X size={19} />
          <span>End</span>
        </button>
      </div>

      {/* ---- Settings sheet ---- */}
      {showSettings && (
        <div className="voice-sheet" role="dialog" aria-label="Voice settings">
          <p className="voice-sheet-title">Session</p>
          <div className="voice-chips">
            {sessionTypes.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSessionType(s.id)}
                aria-pressed={sessionType === s.id}
                className={`voice-chip ${sessionType === s.id ? "is-on" : ""}`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <p className="voice-sheet-title">Voice</p>
          <div className="voice-sheet-rows">
            <SheetLink
              label="Voice, speed and pitch"
              onClick={() => router.push("/chat?settings=voice")}
            />
            <SheetLink
              label="Interruption and auto-listen"
              onClick={() => router.push("/chat?settings=live-voice")}
            />
          </div>

          <p className="voice-sheet-note">
            {localOnly
              ? "A local model is available on this server, so this conversation can be processed without leaving it."
              : "This conversation is processed by a hosted service. Speech recognition and playback stay in your browser — no audio is uploaded."}
          </p>

          <button
            type="button"
            onClick={() => setShowSettings(false)}
            className="voice-sheet-close"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}

function SheetLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="voice-sheet-row">
      {label}
    </button>
  );
}
