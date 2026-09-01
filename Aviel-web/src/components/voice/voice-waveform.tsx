"use client";

// Aviel — the voice waveform.
//
// Drawn from the analyser's real frequency bins while the microphone is the
// source. Like the orb it runs on its own animation frame and never re-renders.
//
// One honest limitation, stated here because it shapes the code: while Aviel
// is speaking there is no audio to analyse. `speechSynthesis` plays through the
// browser's own output and exposes no stream, no AudioNode and no amplitude —
// there is nothing to attach an AnalyserNode to. So the speaking waveform is
// driven by the synthesiser's own `onboundary` events, which are real signals
// emitted as each word is actually spoken, rather than by amplitude. It is not
// a loop pretending to be audio; it is the real word-level timing of the real
// utterance, which is the most the platform gives us. `speechEnergyRef` carries
// that value.

import { useEffect, useRef } from "react";
import type { VoiceState } from "@/lib/voice/voice-state";
import { voicePalette } from "@/lib/voice/voice-state";

const BARS = 64;

const COLORS = {
  blue: ["#2f80ff", "#58a6ff"],
  orange: ["#ff6b00", "#ff9f43"],
  mixed: ["#2f80ff", "#ff7a18"],
  dim: ["#3a4a6a", "#2a3550"],
} as const;

export function VoiceWaveform({
  state,
  binsRef,
  speechEnergyRef,
  width = 320,
  height = 56,
  className = "",
  reducedMotion = false,
}: {
  state: VoiceState;
  /** Live analyser bins, 0–1. Microphone only. */
  binsRef: React.MutableRefObject<Float32Array>;
  /** 0–1, from synthesis boundary events while Aviel speaks. */
  speechEnergyRef: React.MutableRefObject<number>;
  width?: number;
  height?: number;
  className?: string;
  reducedMotion?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const reducedRef = useRef(reducedMotion);
  reducedRef.current = reducedMotion;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const heights = new Float32Array(BARS);
    let raf = 0;
    let t = 0;

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const s = stateRef.current;
      t += reducedRef.current ? 0.01 : 0.05;

      const family = voicePalette(s);
      const [c1, c2] = COLORS[family];

      for (let i = 0; i < BARS; i++) {
        let target = 0;

        if (s === "listening" || s === "interrupted") {
          // Real microphone data. The bins are sampled across the useful
          // speech range rather than the whole spectrum, most of which is
          // empty and would render as a flat line at both ends.
          const bins = binsRef.current;
          const idx = Math.floor((i / BARS) * (bins.length * 0.55));
          target = bins[idx] ?? 0;
        } else if (s === "speaking") {
          // Word-level energy from the synthesiser, shaped into a band so it
          // reads as speech rather than a single pulsing block.
          const e = speechEnergyRef.current;
          const centre = 1 - Math.abs(i / BARS - 0.5) * 1.7;
          target = e * Math.max(0, centre) * (0.55 + Math.sin(i * 0.7 + t * 4) * 0.45);
        } else if (s === "processing") {
          // A travelling band. Not audio and not claiming to be — it marks
          // that work is happening, which is all there is to show.
          const wave = Math.sin(i * 0.28 - t * 2.4);
          target = Math.max(0, wave) * 0.42;
        } else {
          target = 0.03;
        }

        heights[i] += (target - heights[i]) * 0.28;
      }

      ctx.clearRect(0, 0, width, height);

      const grad = ctx.createLinearGradient(0, 0, width, 0);
      grad.addColorStop(0, c1);
      grad.addColorStop(0.5, c2);
      grad.addColorStop(1, c1);
      ctx.fillStyle = grad;

      const gap = 2;
      const barW = Math.max(1.5, width / BARS - gap);
      const mid = height / 2;

      for (let i = 0; i < BARS; i++) {
        const h = Math.max(2, heights[i] * height * 0.92);
        const x = i * (barW + gap);
        // Mirrored around the centre line, which is what makes it read as a
        // waveform rather than a bar chart.
        ctx.beginPath();
        ctx.roundRect(x, mid - h / 2, barW, h, barW / 2);
        ctx.fill();
      }
    };

    draw();
    return () => cancelAnimationFrame(raf);
  }, [width, height, binsRef, speechEnergyRef]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width, height }}
      aria-hidden
    />
  );
}
