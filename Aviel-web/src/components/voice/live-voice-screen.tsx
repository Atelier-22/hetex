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
import type { UserSettings } from "@/lib/settings/types";
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

type SessionRecord = {
  id: string;
  type: string;
  conversationId: string | null;
  temporary: boolean;
};

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
  const { settings, meta, update } = useSettingsStore();
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
  const [sessionSaving, setSessionSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
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
  const sessionTypeRef = useRef(sessionType);
  sessionTypeRef.current = sessionType;
  const finalRef = useRef("");
  const convRef = useRef(conversationId);
  const interruptRaf = useRef(0);
  /** The server-side session this conversation belongs to, once one exists. */
  const sessionRef = useRef<string | null>(sessionId ?? null);
  /** Number of completed exchanges, used to decide whether a summary is worth asking for. */
  const exchangesRef = useRef(0);

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

  /**
   * Close the session on unmount too, not only when End is pressed.
   *
   * Leaving with the browser's back gesture never runs `end`, which would leave
   * the session open forever with no end time and a duration that grows until
   * someone notices. Safe under StrictMode's double-invoke because a session id
   * only exists after `begin` has run.
   */
  useEffect(
    () => () => {
      const id = sessionRef.current;
      if (!id) return;
      sessionRef.current = null;
      void apiFetch(`/sessions/${id}/end`, {
        method: "POST",
        body: JSON.stringify({ summarize: false }),
      }).catch(() => {});
    },
    []
  );

  const end = useCallback(
    (reason?: string) => {
      teardown();
      stateRef.current = "idle";
      setStateRaw("idle");
      if (reason) setError(reason);

      // Close the session record so it stops counting as open and gets its
      // duration written. A summary is only worth a model call once there is
      // something to summarise, and only if the transcript is being kept —
      // summarising a session the user asked not to save would defeat the point
      // of the setting.
      const id = sessionRef.current;
      if (!id) return;
      sessionRef.current = null;
      void apiFetch(`/sessions/${id}/end`, {
        method: "POST",
        body: JSON.stringify({
          summarize:
            exchangesRef.current >= 2 && settingsRef.current.liveVoice.saveTranscript,
        }),
      }).catch(() => {
        // Ending is best-effort. The session row is still closed by its own
        // retention sweep, and failing here must not block leaving the screen.
      });
    },
    [teardown]
  );

  /**
   * Session type.
   *
   * Before the session starts this is only a choice; once it is running the
   * change goes to the server, because the type is what shapes the system
   * prompt for every subsequent turn. If the server refuses, the chip goes back
   * rather than showing a mode the conversation is not actually in.
   */
  const changeSessionType = useCallback(
    async (next: string) => {
      const previous = sessionType;
      setSessionType(next);

      const id = sessionRef.current;
      if (!id) return;

      setSessionSaving(true);
      try {
        await apiFetch(`/sessions/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ type: next }),
        });
      } catch (err) {
        setSessionType(previous);
        setError(
          err instanceof Error ? err.message : "That session type couldn't be applied."
        );
      } finally {
        setSessionSaving(false);
      }
    },
    [sessionType]
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
        exchangesRef.current += 1;
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

    // The session record is created only once the microphone is actually open.
    // Creating it before would leave a trail of empty sessions every time
    // someone opened this screen and denied the permission prompt.
    if (!sessionRef.current) {
      try {
        const session = await apiFetch<SessionRecord>("/sessions", {
          method: "POST",
          body: JSON.stringify({
            type: sessionTypeRef.current,
            temporary: !settingsRef.current.liveVoice.saveTranscript,
            // Adopt the conversation this was entered from, so speaking
            // continues the thread rather than starting a parallel one.
            ...(convRef.current ? { conversationId: convRef.current } : {}),
          }),
        });
        sessionRef.current = session.id;
        if (session.conversationId) convRef.current = session.conversationId;
      } catch (err) {
        engine.stop();
        engineRef.current = null;
        setError(
          err instanceof Error ? err.message : "The session couldn't be started."
        );
        setState("error");
        return;
      }
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

  /**
   * Play a sample in the currently selected voice.
   *
   * If the session is live the recogniser has to come down first, or the sample
   * is transcribed as though the user had said it — the microphone cannot tell
   * the speakers apart from a person.
   */
  const previewVoice = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const wasListening = stateRef.current === "listening";
    if (wasListening) {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
      engineRef.current?.setMuted(true);
    }

    window.speechSynthesis.cancel();

    const v = settingsRef.current.voice;
    const u = new SpeechSynthesisUtterance("This is how I'll sound.");
    u.rate = v.rate;
    u.pitch = v.pitch;
    u.volume = v.volume;
    const voice = pickVoice(v, voices, settingsRef.current.language.voiceOutput);
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang;
    }

    const restore = () => {
      setPreviewing(false);
      if (!wasListening) return;
      engineRef.current?.setMuted(false);
      if (stateRef.current === "listening") startListening();
    };
    u.onend = restore;
    u.onerror = restore;

    setPreviewing(true);
    window.speechSynthesis.speak(u);
  }, [voices, startListening]);

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

      {/* ---- Settings sheet ----
          Everything here is adjustable without leaving the conversation.
          Sending someone to the settings screen mid-session meant tearing down
          the microphone to change the speaking rate. */}
      {showSettings && (
        <div className="voice-sheet" role="dialog" aria-label="Voice settings">
          <div className="voice-sheet-scroll">
            {/* Only when the server actually returned a catalogue. A heading
                above nothing reads as a section that failed to load, which is
                exactly what it would be. */}
            {sessionTypes.length > 0 && (
              <>
                <div className="voice-sheet-head">
                  <p className="voice-sheet-title">Session</p>
                  {sessionSaving && <Loader2 size={13} className="animate-spin" />}
                </div>
                <div className="voice-chips">
                  {sessionTypes.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => void changeSessionType(s.id)}
                      disabled={sessionSaving}
                      aria-pressed={sessionType === s.id}
                      title={s.description}
                      className={`voice-chip ${sessionType === s.id ? "is-on" : ""}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                {activeSession && (
                  <p className="voice-sheet-hint">{activeSession.description}</p>
                )}
              </>
            )}

            <p className="voice-sheet-title">Voice</p>
            <SheetSelect
              label="Speaking voice"
              value={settings.voice.outputVoice ?? ""}
              onChange={(v) =>
                void update({ voice: { outputVoice: v || null } })
              }
              options={[
                { value: "", label: "System default" },
                ...voices.map((v) => ({
                  value: v.name,
                  label: `${v.name} — ${v.lang}`,
                })),
              ]}
              after={
                <button
                  type="button"
                  onClick={previewVoice}
                  disabled={previewing || state === "speaking"}
                  className="voice-sheet-preview"
                >
                  {previewing ? "Playing…" : "Preview"}
                </button>
              }
            />

            <SheetRange
              label="Speed"
              value={settings.voice.rate}
              min={0.5}
              max={2}
              step={0.1}
              format={(v) => `${v.toFixed(1)}×`}
              onChange={(v) => void update({ voice: { rate: v } })}
            />
            <SheetRange
              label="Pitch"
              value={settings.voice.pitch}
              min={0.5}
              max={2}
              step={0.1}
              format={(v) => v.toFixed(1)}
              onChange={(v) => void update({ voice: { pitch: v } })}
            />
            <SheetRange
              label="Volume"
              value={settings.voice.volume}
              min={0}
              max={1}
              step={0.05}
              format={(v) => `${Math.round(v * 100)}%`}
              onChange={(v) => void update({ voice: { volume: v } })}
            />

            <SheetSelect
              label="Response style"
              value={settings.personality.responseStyle}
              onChange={(v) =>
                void update({
                  personality: {
                    responseStyle: v as UserSettings["personality"]["responseStyle"],
                  },
                })
              }
              options={[
                { value: "concise", label: "Concise — best for talking" },
                { value: "balanced", label: "Balanced" },
                { value: "detailed", label: "Detailed" },
                { value: "very_detailed", label: "Very detailed" },
              ]}
            />

            <p className="voice-sheet-title">Conversation</p>
            <SheetToggle
              label="Let me interrupt"
              description="Speaking over Aviel stops it and hands the turn back."
              checked={settings.liveVoice.allowInterrupt}
              onChange={(v) => void update({ liveVoice: { allowInterrupt: v } })}
            />
            <SheetToggle
              label="Listen automatically"
              description="Start listening again as soon as Aviel finishes."
              checked={settings.liveVoice.continuousListening}
              onChange={(v) =>
                void update({ liveVoice: { continuousListening: v } })
              }
            />
            <SheetToggle
              label="Speak replies aloud"
              description="Turn off to read replies in the transcript instead."
              checked={settings.liveVoice.autoResponse}
              onChange={(v) => void update({ liveVoice: { autoResponse: v } })}
            />
            <SheetToggle
              label="End turns on silence"
              description="A pause finishes your turn, so you needn't press anything."
              checked={settings.liveVoice.voiceActivityDetection}
              onChange={(v) =>
                void update({ liveVoice: { voiceActivityDetection: v } })
              }
            />
            <SheetToggle
              label="Noise cancellation"
              description="Applies from the next session — the microphone is already open."
              checked={settings.voice.noiseReduction}
              onChange={(v) => void update({ voice: { noiseReduction: v } })}
            />
            <SheetToggle
              label="Keep this transcript"
              description="Off means the conversation is discarded when it ends."
              checked={settings.liveVoice.saveTranscript}
              onChange={(v) => void update({ liveVoice: { saveTranscript: v } })}
            />

            <p className="voice-sheet-note">
              {localOnly
                ? "A local model is available on this server, so this conversation can be processed without leaving it."
                : "This conversation is processed by a hosted service. Speech recognition and playback stay in your browser — no audio is uploaded."}
            </p>

            <button
              type="button"
              onClick={() => router.push("/chat?settings=live-voice")}
              className="voice-sheet-row"
            >
              All voice settings
            </button>
          </div>

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

/* -------------------------------------------------------------------------- */
/* Sheet controls                                                             */
/*                                                                            */
/* Deliberately local rather than reusing the settings-screen primitives:      */
/* those are built for a wide two-column form on an opaque panel, and they     */
/* look wrong sitting on glass over a live orb. The state they write is the    */
/* same store, so a change here shows up there.                               */
/* -------------------------------------------------------------------------- */

function SheetToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="voice-sheet-field">
      <div className="min-w-0">
        <p className="voice-sheet-label">{label}</p>
        {description && <p className="voice-sheet-desc">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`voice-switch ${checked ? "is-on" : ""}`}
      >
        <span />
      </button>
    </div>
  );
}

function SheetRange({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="voice-sheet-field voice-sheet-field--stack">
      <div className="flex items-center justify-between gap-3">
        <p className="voice-sheet-label">{label}</p>
        <span className="voice-sheet-value tabular-nums">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className="voice-range"
      />
    </div>
  );
}

function SheetSelect({
  label,
  value,
  options,
  onChange,
  after,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  after?: React.ReactNode;
}) {
  return (
    <div className="voice-sheet-field voice-sheet-field--stack">
      <p className="voice-sheet-label">{label}</p>
      <div className="flex items-center gap-2">
        <select
          value={value}
          aria-label={label}
          onChange={(e) => onChange(e.target.value)}
          className="voice-select"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {after}
      </div>
    </div>
  );
}
