"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

const ICON_SRC = "/brand/aviel-logo-color.png";
const LOCKUP_LIGHT_SRC = "/brand/aviel-lockup-light.png"; // dark text, for light backgrounds
const LOCKUP_DARK_SRC = "/brand/aviel-lockup-dark.png"; // white text, for dark backgrounds

/**
 * Drawn stand-in used until the artwork is in place, and if it ever fails to
 * load afterwards.
 *
 * It is deliberately visible. An invisible fallback makes a missing file look
 * like a broken layout, which is harder to diagnose than an obviously
 * placeholder mark.
 */
function FallbackMark({ size, className = "" }: { size: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role="img"
      aria-label="Aviel AI"
      className={`shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <defs>
        <linearGradient id="aviel-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--accent-from)" />
          <stop offset="100%" stopColor="var(--accent-to)" />
        </linearGradient>
      </defs>
      <circle
        cx="32"
        cy="32"
        r="27"
        fill="none"
        stroke="url(#aviel-mark)"
        strokeWidth="5"
      />
      {/* Speed lines, echoing the motion in the real mark. */}
      <g stroke="url(#aviel-mark)" strokeWidth="3.5" strokeLinecap="round">
        <line x1="14" y1="27" x2="30" y2="27" />
        <line x1="18" y1="34" x2="34" y2="34" />
        <line x1="22" y1="41" x2="32" y2="41" />
      </g>
      <text
        x="40"
        y="41"
        textAnchor="middle"
        fontSize="22"
        fontWeight="700"
        fill="url(#aviel-mark)"
        fontFamily="inherit"
      >
        H
      </text>
    </svg>
  );
}

/**
 * The Aviel icon — horse-in-circle, no wordmark.
 *
 * The artwork carries its own green-blue gradient and is not recoloured by the
 * accent preference; a logo that changes colour stops reading as a logo. The
 * drawn fallback does follow the accent, because it is interface chrome rather
 * than the brand.
 *
 * Width and height are both set so the browser reserves the space before the
 * image loads, rather than reflowing the page around it.
 */
export function AvielIcon({
  size = 32,
  className = "",
  priority = false,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) return <FallbackMark size={size} className={className} />;

  return (
    <img
      src={ICON_SRC}
      alt="Aviel AI"
      width={size}
      height={size}
      onError={() => setFailed(true)}
      loading={priority ? "eager" : "lazy"}
      className={`shrink-0 object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

/**
 * The full lockup — icon plus the AVIEL AI wordmark.
 *
 * Two files exist because the wordmark colour is baked into the artwork: dark
 * text for light backgrounds, white for dark. Picking by resolved theme rather
 * than by CSS keeps the contrast right in both, including "system".
 *
 * Sizing is height-driven with `width: auto`, so the artwork's own aspect ratio
 * decides its width and it can never come out stretched. A supplied `width` is
 * treated as a maximum for the same reason.
 */
export function AvielLockup({
  height = 28,
  width,
  className = "",
  priority = false,
}: {
  height?: number;
  width?: number;
  className?: string;
  priority?: boolean;
}) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [failed, setFailed] = useState(false);

  // resolvedTheme is only known on the client. Rendering a guess on the server
  // and correcting it after hydration would flash the wrong wordmark.
  useEffect(() => setMounted(true), []);

  if (failed || (mounted && !LOCKUP_LIGHT_SRC)) {
    return (
      <span className={`flex items-center gap-2 ${className}`}>
        <FallbackMark size={height} />
        <span
          className="font-bold tracking-tight"
          style={{ fontSize: Math.round(height * 0.62) }}
        >
          AVIEL AI
        </span>
      </span>
    );
  }

  // Before hydration, reserve the space without committing to a variant.
  if (!mounted) {
    return (
      <span
        className={`inline-block ${className}`}
        style={width ? { width, height } : { height }}
        aria-hidden
      />
    );
  }

  const src = resolvedTheme === "dark" ? LOCKUP_DARK_SRC : LOCKUP_LIGHT_SRC;

  return (
    <img
      src={src}
      alt="Aviel AI"
      onError={() => setFailed(true)}
      loading={priority ? "eager" : "lazy"}
      className={`object-contain ${className}`}
      style={
        width
          ? { width: "100%", maxWidth: width, height: "auto" }
          : { height, width: "auto" }
      }
    />
  );
}
