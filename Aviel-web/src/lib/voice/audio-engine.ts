"use client";

// Aviel — the voice audio engine.
//
// Opens the microphone once and runs an AnalyserNode over it. Everything the
// orb and the waveform draw comes from this: real amplitude, real frequency
// data, real voice-activity detection.
//
// Two deliberate decisions:
//
//   * The analysis loop never touches React state. A setState per frame at
//     60fps re-renders the tree sixty times a second and the orb stutters
//     exactly when it matters most. Consumers read `level` and `bins` from the
//     live object instead, inside their own animation frame.
//
//   * Voice activity is measured against a noise floor sampled from the room,
//     not a fixed threshold. A fixed number works in a quiet office and fails
//     completely next to a fan.

export type EngineStatus =
  | "idle"
  | "requesting"
  | "running"
  | "denied"
  | "unavailable"
  | "error";

export interface VoiceActivityOptions {
  /** Fires when speech starts, after `speechStartMs` of sustained sound. */
  onSpeechStart?: () => void;
  /** Fires after `silenceMs` of quiet following speech. */
  onSpeechEnd?: () => void;
  /** How long sound must persist before it counts as speech, not a cough. */
  speechStartMs?: number;
  /** How long quiet must persist before a turn is considered finished. */
  silenceMs?: number;
}

const FFT_SIZE = 512;
const NOISE_FLOOR_SAMPLES = 30;
/** Speech has to clear the room's noise floor by this much to register. */
const SPEECH_MARGIN = 0.035;
/** How long to wait for the microphone before giving up and saying so. */
const MIC_TIMEOUT_MS = 10_000;

export class AudioEngine {
  status: EngineStatus = "idle";
  /** 0–1 RMS amplitude of the microphone, updated every frame. */
  level = 0;
  /** Frequency magnitudes, 0–1, for the waveform. */
  bins: Float32Array = new Float32Array(FFT_SIZE / 2);
  /** Whether the engine currently believes someone is talking. */
  speaking = false;
  error: string | null = null;

  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private raf = 0;
  private timeData = new Uint8Array(new ArrayBuffer(FFT_SIZE));
  private freqData = new Uint8Array(new ArrayBuffer(FFT_SIZE / 2));

  private noiseFloor = 0.01;
  private noiseSamples: number[] = [];

  private speechSince = 0;
  private silenceSince = 0;
  private opts: VoiceActivityOptions = {};

  /** Set while the assistant is speaking, so its own audio is not heard as the user. */
  muted = false;

  async start(
    opts: VoiceActivityOptions & { noiseReduction?: boolean; highQuality?: boolean } = {}
  ): Promise<EngineStatus> {
    this.opts = opts;

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      this.status = "unavailable";
      this.error = "This browser has no microphone API.";
      return this.status;
    }

    if (this.status === "running") return this.status;

    this.status = "requesting";

    try {
      // getUserMedia is specified to resolve or reject, but in practice it can
      // hang indefinitely — a permission prompt nobody answers, a headless or
      // virtualised environment with no audio subsystem, a device held by
      // another application. Without a bound, the session sits on
      // "Connecting…" forever with no way back.
      this.stream = await Promise.race([
        navigator.mediaDevices.getUserMedia({
          audio: {
            // Echo cancellation is what stops the assistant's own voice being
            // picked up as an interruption when the speakers are loud.
            echoCancellation: true,
            noiseSuppression: opts.noiseReduction ?? true,
            autoGainControl: true,
            ...(opts.highQuality ? { sampleRate: 48000 } : {}),
          },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new DOMException("Timed out", "TimeoutError")),
            MIC_TIMEOUT_MS
          )
        ),
      ]);
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      this.status = name === "NotAllowedError" ? "denied" : "error";
      this.error =
        name === "NotAllowedError"
          ? "Microphone access was refused. Allow it for this site in your browser, then try again."
          : name === "NotFoundError"
            ? "No microphone was found on this device."
            : name === "NotReadableError"
              ? "The microphone is in use by another application."
              : name === "TimeoutError"
                ? "The microphone didn't respond. Check that this device has one and that nothing else is using it."
                : "The microphone could not be opened.";
      return this.status;
    }

    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;

    if (!Ctx) {
      this.stop();
      this.status = "unavailable";
      this.error = "This browser has no Web Audio support.";
      return this.status;
    }

    this.ctx = new Ctx();
    // Deliberately not awaited. A suspended context resumes on the next user
    // gesture, and in some environments the promise simply never settles —
    // awaiting it leaves the session stuck on "Connecting…" forever with a
    // perfectly good microphone already open.
    if (this.ctx.state === "suspended") {
      void this.ctx.resume().catch(() => {});
    }

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = FFT_SIZE;
    // Smoothing is what stops the orb jittering on every consonant.
    this.analyser.smoothingTimeConstant = 0.72;

    this.source = this.ctx.createMediaStreamSource(this.stream);
    this.source.connect(this.analyser);

    this.timeData = new Uint8Array(new ArrayBuffer(this.analyser.fftSize));
    this.freqData = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));
    this.bins = new Float32Array(this.analyser.frequencyBinCount);

    this.noiseSamples = [];
    this.status = "running";
    this.tick();

    return this.status;
  }

  private tick = () => {
    if (!this.analyser) return;
    this.raf = requestAnimationFrame(this.tick);

    this.analyser.getByteTimeDomainData(this.timeData);
    this.analyser.getByteFrequencyData(this.freqData);

    // RMS over the time-domain samples, centred on 128.
    let sum = 0;
    for (let i = 0; i < this.timeData.length; i++) {
      const v = (this.timeData[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / this.timeData.length);

    this.level = this.muted ? 0 : rms;

    for (let i = 0; i < this.freqData.length; i++) {
      this.bins[i] = this.muted ? 0 : this.freqData[i] / 255;
    }

    // The first half-second of quiet establishes what "quiet" means here.
    if (this.noiseSamples.length < NOISE_FLOOR_SAMPLES) {
      this.noiseSamples.push(rms);
      if (this.noiseSamples.length === NOISE_FLOOR_SAMPLES) {
        const sorted = [...this.noiseSamples].sort((a, b) => a - b);
        this.noiseFloor = sorted[Math.floor(sorted.length / 2)];
      }
      return;
    }

    if (this.muted) return;
    this.detectActivity(rms);
  };

  private detectActivity(rms: number) {
    const now = performance.now();
    const loud = rms > this.noiseFloor + SPEECH_MARGIN;
    const startMs = this.opts.speechStartMs ?? 140;
    const silenceMs = this.opts.silenceMs ?? 900;

    if (loud) {
      this.silenceSince = 0;
      if (!this.speaking) {
        if (!this.speechSince) this.speechSince = now;
        else if (now - this.speechSince >= startMs) {
          this.speaking = true;
          this.opts.onSpeechStart?.();
        }
      }
      return;
    }

    this.speechSince = 0;
    if (!this.speaking) return;

    if (!this.silenceSince) this.silenceSince = now;
    else if (now - this.silenceSince >= silenceMs) {
      this.speaking = false;
      this.silenceSince = 0;
      this.opts.onSpeechEnd?.();
    }
  }

  /** Silences analysis without closing the microphone, for while Aviel talks. */
  setMuted(muted: boolean) {
    this.muted = muted;
    if (muted) {
      this.speaking = false;
      this.speechSince = 0;
      this.silenceSince = 0;
      this.level = 0;
      this.bins.fill(0);
    }
  }

  /**
   * Whether the microphone is hearing speech right now.
   *
   * Used for interruption while the assistant is talking, which is the one
   * case where analysis has to keep running with the engine muted — so this
   * reads the raw analyser rather than the muted `level`.
   */
  rawLevel(): number {
    if (!this.analyser) return 0;
    this.analyser.getByteTimeDomainData(this.timeData);
    let sum = 0;
    for (let i = 0; i < this.timeData.length; i++) {
      const v = (this.timeData[i] - 128) / 128;
      sum += v * v;
    }
    return Math.sqrt(sum / this.timeData.length);
  }

  isLoud(): boolean {
    return this.rawLevel() > this.noiseFloor + SPEECH_MARGIN * 1.6;
  }

  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;

    this.source?.disconnect();
    this.analyser?.disconnect();
    this.source = null;
    this.analyser = null;

    // Releasing the tracks is what turns off the browser's recording
    // indicator. Leaving them open is the difference between a session that
    // ended and one that only looks ended.
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;

    void this.ctx?.close().catch(() => {});
    this.ctx = null;

    this.level = 0;
    this.bins.fill(0);
    this.speaking = false;
    this.status = "idle";
  }
}
