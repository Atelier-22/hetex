"use client";

/* eslint-disable @next/next/no-img-element */

// Aviel — the mark and the wordmark.
//
// The mark is artwork and stays artwork: one PNG, carrying its own colour, not
// recoloured by the accent preference. A logo that changes colour with a theme
// setting stops reading as a logo.
//
// The wordmark beneath it is type rather than a second image. That is what
// removes the old light/dark lockup pair: the word and the strapline follow the
// theme on their own, stay crisp at any size, and never need re-exporting when
// the strapline changes.

import { useState } from "react";

const ICON_SRC = "/brand/Aviel-logo-color.png";

const TAGLINE = "Think · Decide · Grow";

/**
 * Drawn stand-in, used only if the artwork fails to load.
 *
 * Deliberately visible rather than blank: an invisible fallback makes a missing
 * file look like a broken layout, which is harder to diagnose than an obviously
 * placeholder mark. It follows the accent because it is interface chrome, not
 * the brand.
 */
function FallbackMark({ size, className = "" }: { size: number; className?: string }) {
  return (
    <span
      role="img"
      aria-label="Aviel"
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        backgroundImage:
          "linear-gradient(to bottom right, var(--accent-from), var(--accent-to))",
        color: "#fff",
        fontFamily: "var(--font-serif)",
        fontSize: size * 0.55,
        // A serif capital sits high in its em box, so it needs nudging down to
        // look centred rather than merely be centred.
        paddingTop: size * 0.04,
        lineHeight: 1,
        fontWeight: 500,
      }}
    >
      A
    </span>
  );
}

/**
 * The Aviel mark on its own — no wordmark.
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
      alt="Aviel"
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
 * The full lockup: the mark, then "Aviel", then the strapline.
 *
 * `height` sizes the mark, and the type scales from it, so a call site sets one
 * number and the proportions hold. Below about 22px the strapline stops being
 * readable and is dropped rather than rendered as a grey smear.
 */
export function AvielLockup({
  height = 64,
  width,
  className = "",
  showTagline = true,
  align = "center",
  priority = false,
}: {
  /** Size of the mark. The wordmark and strapline scale from it. */
  height?: number;
  width?: number;
  className?: string;
  /** Off in tight places — a sidebar header does not need the strapline. */
  showTagline?: boolean;
  align?: "left" | "center";
  priority?: boolean;
}) {
  const wordSize = Math.round(height * 0.52);
  const taglineSize = Math.max(8, Math.round(height * 0.135));
  const withTagline = showTagline && wordSize >= 18;
  const centered = align === "center";

  return (
    <span
      className={`inline-flex select-none flex-col leading-none ${
        centered ? "items-center text-center" : "items-start"
      } ${className}`}
      style={width ? { maxWidth: width } : undefined}
    >
      <AvielIcon size={height} priority={priority} />

      <span
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: wordSize,
          fontWeight: 500,
          letterSpacing: "0.01em",
          lineHeight: 1,
          marginTop: height * 0.22,
          color: "var(--text-primary)",
        }}
      >
        Aviel
      </span>

      {withTagline && (
        <span
          style={{
            fontSize: taglineSize,
            // Wide tracking is what makes a strapline read as one, and it has
            // to scale with the type or it collapses at large sizes.
            letterSpacing: "0.3em",
            // Tracking adds space after the final letter too, which throws the
            // block off-centre against the word above it.
            marginRight: centered ? "-0.3em" : undefined,
            marginTop: wordSize * 0.42,
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
 * Mark and word side by side, for a horizontal header.
 *
 * Separate from the stacked lockup because that one is centred and this one is
 * not — one component doing both produced a lockup subtly wrong in whichever
 * place it was not designed for.
 */
export function AvielLockupInline({
  height = 28,
  className = "",
  showTagline = false,
  priority = false,
}: {
  height?: number;
  className?: string;
  showTagline?: boolean;
  priority?: boolean;
}) {
  const wordSize = Math.round(height * 0.72);

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <AvielIcon size={height} priority={priority} />
      <span className="inline-flex flex-col leading-none">
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
        {showTagline && (
          <span
            style={{
              fontSize: Math.max(7, Math.round(height * 0.22)),
              letterSpacing: "0.24em",
              marginTop: height * 0.16,
              textTransform: "uppercase",
              color: "var(--text-secondary)",
              whiteSpace: "nowrap",
            }}
          >
            {TAGLINE}
          </span>
        )}
      </span>
    </span>
  );
}
