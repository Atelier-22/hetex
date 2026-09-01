"use client";

// Aviel — the wordmark.
//
// Drawn as type rather than loaded as an image. A PNG lockup has to ship two
// files for light and dark, goes soft on a high-density screen, and reflows the
// layout while it loads. Set as text it is crisp at any size, follows the
// theme, and costs nothing to render.
//
// The serif is loaded once in the root layout and exposed as --font-serif, so
// the wordmark and the tagline are the only things using it and it never leaks
// into interface copy.

import { useEffect, useState } from "react";

/** Letterspacing that keeps the tagline legible as it shrinks. */
const TAGLINE = "Think · Decide · Grow";

/**
 * The mark on its own — an "A" in the brand serif, inside a soft square.
 *
 * Used where there is no room for the full wordmark: a collapsed sidebar, an
 * avatar slot, a favicon-sized corner.
 */
export function AvielIcon({
  size = 32,
  className = "",
  // Kept for call-site compatibility; nothing is fetched, so there is nothing
  // to prioritise.
  priority: _priority = false,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <span
      role="img"
      aria-label="Aviel"
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-[22%] ${className}`}
      style={{
        width: size,
        height: size,
        // The mark is the one place the accent gradient is allowed to carry
        // the brand, because there is no wordmark to carry it instead.
        backgroundImage:
          "linear-gradient(to bottom right, var(--accent-from), var(--accent-to))",
        color: "#fff",
        fontFamily: "var(--font-serif)",
        // Optically centred: a serif capital sits high in its em box, so the
        // glyph needs nudging down to look centred rather than measured.
        fontSize: size * 0.58,
        lineHeight: 1,
        paddingTop: size * 0.04,
        fontWeight: 500,
      }}
    >
      A
    </span>
  );
}

/**
 * The full wordmark: "Aviel" over the tagline.
 *
 * `height` drives the whole lockup so a call site can size it the way it sized
 * the old image, and the tagline scales with it. Below about 22px the tagline
 * stops being readable and is dropped rather than rendered as a grey smear.
 */
export function AvielLockup({
  height = 28,
  width,
  className = "",
  showTagline = true,
  align = "left",
  priority: _priority = false,
}: {
  height?: number;
  width?: number;
  className?: string;
  /** Off in tight places — a sidebar header does not need the strapline. */
  showTagline?: boolean;
  /** Centred for the brand moments, left-aligned inside a header row. */
  align?: "left" | "center";
  priority?: boolean;
}) {
  const wordSize = height;
  const taglineSize = Math.max(7, Math.round(height * 0.26));
  const withTagline = showTagline && height >= 22;
  const centered = align === "center";

  return (
    <span
      className={`inline-flex select-none flex-col justify-center leading-none ${
        centered ? "items-center text-center" : "items-start"
      } ${className}`}
      style={width ? { maxWidth: width } : undefined}
    >
      <span
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: wordSize,
          fontWeight: 500,
          letterSpacing: "0.01em",
          lineHeight: 1,
          color: "var(--text-primary)",
        }}
      >
        Aviel
      </span>

      {withTagline && (
        <span
          aria-hidden
          style={{
            fontSize: taglineSize,
            // Wide tracking is what makes a strapline read as one, and it has
            // to grow with the type or it collapses at large sizes.
            letterSpacing: "0.32em",
            // Tracking adds space after the last letter too, which throws the
            // block off-centre against the word above it.
            marginRight: "-0.32em",
            marginTop: height * 0.28,
            textTransform: "uppercase",
            color: "var(--text-secondary)",
            whiteSpace: "nowrap",
          }}
        >
          {TAGLINE}
        </span>
      )}
    </span>
  );
}

/**
 * Mark and wordmark side by side, for a horizontal header.
 *
 * Separate from `AvielLockup` because the stacked lockup is centred and this
 * one is not — trying to make one component do both produced a lockup that was
 * subtly wrong in whichever place it was not designed for.
 */
export function AvielLockupInline({
  height = 28,
  className = "",
  showTagline = false,
}: {
  height?: number;
  className?: string;
  showTagline?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <span
      className={`inline-flex items-center gap-2.5 ${className}`}
      // Space is reserved before hydration so the header does not jump.
      style={{ minHeight: height }}
      suppressHydrationWarning
    >
      <AvielIcon size={height} />
      {mounted && (
        <AvielLockup height={height * 0.82} showTagline={showTagline} />
      )}
    </span>
  );
}
