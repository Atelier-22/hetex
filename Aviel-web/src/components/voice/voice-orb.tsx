"use client";

// Aviel — the voice orb.
//
// Canvas rather than CSS. The orb has to deform against live audio at 60fps;
// a DOM element with animated gradients repaints the whole layer every frame
// and drops to a slideshow the moment anything else is happening.
//
// It never re-renders. React mounts the canvas once and the loop reads the
// audio level through a ref, so nothing in the tree updates while the orb is
// moving.

import { useEffect, useRef } from "react";
import type { VoiceState } from "@/lib/voice/voice-state";

const PALETTE = {
  void: "#07142f",
  navy: "#0b1f46",
  blue: "#007aff",
  brightBlue: "#2f80ff",
  softBlue: "#58a6ff",
  orange: "#ff6b00",
  brightOrange: "#ff7a18",
  warmOrange: "#ff9f43",
};

/** Where each state sits between blue (0) and orange (1). */
function stateHue(state: VoiceState): number {
  switch (state) {
    case "speaking":
      return 1;
    case "processing":
      return 0.5;
    case "listening":
    case "interrupted":
      return 0;
    default:
      return 0.25;
  }
}

type Rgb = [number, number, number];

/**
 * Colour is handled as tuples throughout, and only turned into a string at the
 * point it reaches the canvas.
 *
 * The first version mixed hex strings and returned `rgb(...)`, which meant a
 * mixed colour could not be mixed again — the hex parse read "rgb(" and
 * produced NaN — and appending a hex alpha suffix to it produced a string the
 * canvas rejected outright. Keeping the numbers as numbers removes both.
 */
function hexToRgb(hex: string): Rgb {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return a.map((v, i) => Math.round(v + (b[i] - v) * t)) as Rgb;
}

function rgba([r, g, b]: Rgb, alpha: number): string {
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
}

export function VoiceOrb({
  state,
  /** Live 0–1 amplitude. Read every frame; never triggers a render. */
  levelRef,
  size = 260,
  className = "",
  reducedMotion = false,
}: {
  state: VoiceState;
  levelRef: React.MutableRefObject<number>;
  size?: number;
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

    // Draw at device resolution so the orb is not soft on a phone.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    // Leaves room inside the canvas for the glow and ripples to fade out
    // rather than being cut off at the edge.
    const base = size * 0.27;

    let raf = 0;
    let t = 0;
    // Smoothed so the orb glides rather than snapping on every sample.
    let smooth = 0;
    let hue = stateHue(state);

    const draw = () => {
      raf = requestAnimationFrame(draw);

      const s = stateRef.current;
      const reduced = reducedRef.current;

      t += reduced ? 0.002 : 0.012;

      const target = Math.min(1, levelRef.current * 3.2);
      smooth += (target - smooth) * 0.14;

      const targetHue = stateHue(s);
      hue += (targetHue - hue) * 0.05;

      // Idle breathes; the rest respond to audio.
      const breath = Math.sin(t * 1.1) * 0.5 + 0.5;
      const energy =
        s === "idle" || s === "paused" || s === "offline"
          ? breath * 0.12
          : s === "processing"
            ? 0.28 + Math.sin(t * 3.4) * 0.1
            : smooth;

      const radius = base * (1 + energy * 0.16);

      ctx.clearRect(0, 0, size, size);

      // Blue and orange are both present at once, on opposite sides, the way
      // the reference lights it. The state shifts which one dominates rather
      // than blending the two into a single muddy hue.
      const cool = mix(hexToRgb(PALETTE.brightBlue), hexToRgb(PALETTE.softBlue), 0.3);
      const warm = mix(hexToRgb(PALETTE.orange), hexToRgb(PALETTE.warmOrange), 0.3);

      // `rim` is the dominant side, `rimAlt` the opposing one. At hue 0 the
      // dominant light is blue; at 1 it is orange.
      const rim = mix(cool, warm, hue);
      const rimAlt = mix(warm, cool, hue);

      /* ---- Outer atmosphere ----
         Clamped to the canvas half-width. A gradient that extends past the
         edge is cut off square, and the orb ends up sitting inside a visible
         lighter rectangle. */
      const reach = Math.min(radius * 2.3, size / 2);
      const glow = ctx.createRadialGradient(cx, cy, radius * 0.62, cx, cy, reach);
      glow.addColorStop(0, rgba(rim, 0.5 + energy * 0.42));
      glow.addColorStop(0.35, rgba(rim, 0.22 + energy * 0.2));
      glow.addColorStop(0.62, rgba(rimAlt, 0.12));
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 2.1, 0, Math.PI * 2);
      ctx.fill();

      /* ---- Ripples, one per recent energy peak ---- */
      if (!reduced && energy > 0.08) {
        for (let i = 0; i < 3; i++) {
          const phase = (t * 0.55 + i / 3) % 1;
          const rr = Math.min(radius * (1.05 + phase * 0.85), size / 2 - 2);
          ctx.beginPath();
          ctx.arc(cx, cy, rr, 0, Math.PI * 2);
          ctx.strokeStyle = rgba(rim, (1 - phase) * energy * 0.47);
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      /* ---- The body: a deformed circle, not a perfect one ---- */
      ctx.beginPath();
      const points = 96;
      for (let i = 0; i <= points; i++) {
        const a = (i / points) * Math.PI * 2;
        // Three summed harmonics give an organic wobble; one looks mechanical.
        const wob =
          Math.sin(a * 3 + t * 1.7) * 0.5 +
          Math.sin(a * 5 - t * 1.1) * 0.3 +
          Math.sin(a * 2 + t * 2.3) * 0.2;
        const r = radius * (1 + wob * energy * 0.13);
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();

      // Lit from the upper left, so it reads as a sphere rather than a disc.
      const body = ctx.createRadialGradient(
        cx - radius * 0.32,
        cy - radius * 0.36,
        radius * 0.05,
        cx,
        cy,
        radius * 1.15
      );
      body.addColorStop(0, rgba(mix(hexToRgb(PALETTE.navy), rim, 0.32), 1));
      body.addColorStop(0.42, PALETTE.navy);
      body.addColorStop(0.82, PALETTE.void);
      body.addColorStop(1, "#02060f");
      ctx.fillStyle = body;
      ctx.fill();

      /* ---- Refracted rim: bright where the light is, dim opposite ---- */
      const rimGrad = ctx.createLinearGradient(
        cx - radius,
        cy - radius,
        cx + radius,
        cy + radius
      );
      // Bright where the light falls, dark across the middle, bright again in
      // the opposing colour — which is what makes it read as a lit sphere
      // rather than an outlined circle.
      rimGrad.addColorStop(0, rgba(rim, 1));
      rimGrad.addColorStop(0.34, rgba(rim, 0.75));
      rimGrad.addColorStop(0.52, rgba(rimAlt, 0.16));
      rimGrad.addColorStop(0.74, rgba(rimAlt, 0.8));
      rimGrad.addColorStop(1, rgba(rimAlt, 1));
      ctx.strokeStyle = rimGrad;
      ctx.lineWidth = 3.5 + energy * 4.5;
      ctx.stroke();

      // A second, tighter pass just inside the first. One stroke reads as a
      // border; two at different widths read as refraction through glass.
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = rgba(mix(rim, [255, 255, 255], 0.45), 0.5 + energy * 0.4);
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();

      /* ---- Internal energy: arcs sweeping inside the glass ---- */
      const arcs = reduced ? 1 : 3;
      for (let i = 0; i < arcs; i++) {
        const spin = t * (0.5 + i * 0.28) + (i * Math.PI * 2) / arcs;
        const rr = radius * (0.42 + i * 0.17);
        ctx.beginPath();
        ctx.ellipse(cx, cy, rr, rr * (0.34 + energy * 0.3), spin, 0, Math.PI * 2);
        ctx.strokeStyle = rgba(i % 2 ? rimAlt : rim, 0.16 + energy * 0.5);
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      /* ---- Specular highlight ---- */
      const spec = ctx.createRadialGradient(
        cx - radius * 0.38,
        cy - radius * 0.42,
        0,
        cx - radius * 0.38,
        cy - radius * 0.42,
        radius * 0.55
      );
      spec.addColorStop(0, `rgba(255,255,255,${0.2 + energy * 0.22})`);
      spec.addColorStop(1, "transparent");
      ctx.fillStyle = spec;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    };

    draw();
    return () => cancelAnimationFrame(raf);
    // size is the only thing that requires a rebuild; state and motion are read
    // through refs so a change does not restart the loop mid-animation.
  }, [size, levelRef]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Aviel voice orb, ${state}`}
    />
  );
}
