"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

const ICON_SRC = "/brand/hetex-logo-color.png";
const LOCKUP_LIGHT_SRC = "/brand/hetex-lockup-light.png"; // dark text, for light backgrounds
const LOCKUP_DARK_SRC = "/brand/hetex-lockup-dark.png"; // white text, for dark backgrounds

/**
 * The Hetex icon — horse-in-circle, no wordmark.
 *
 * The artwork carries its own green-blue gradient and is not recoloured by the
 * accent preference; a logo that changes colour stops reading as a logo.
 *
 * Sized by an explicit square box because the source is square. Width and
 * height are both set so the browser reserves the space before the image
 * loads, rather than reflowing the page around it.
 */
export function HetexIcon({
  size = 32,
  className = "",
  priority = false,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        className={`sr-only ${className}`}
        role="img"
        aria-label="Hetex AI"
      >
        Hetex AI
      </span>
    );
  }

  return (
    <img
      src={ICON_SRC}
      alt="Hetex AI"
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
 * The full lockup — icon plus the HETEX AI wordmark.
 *
 * Two files exist because the wordmark is baked into the artwork: dark text
 * for light backgrounds, white text for dark ones. Picking by resolved theme
 * rather than by CSS keeps the contrast correct in both, including when the
 * theme is "system".
 *
 * Sizing is height-driven with `width: auto`, so the lockup's own aspect ratio
 * decides its width and it can never come out stretched. `width` when given is
 * treated as a maximum for the same reason.
 */
export function HetexLockup({
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

  if (failed) {
    return (
      <span className={`font-semibold ${className}`}>Hetex AI</span>
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
      alt="Hetex AI"
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
