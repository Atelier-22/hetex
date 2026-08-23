"use client";

/* eslint-disable @next/next/no-img-element */

import { useState } from "react";

/**
 * The Hetex mark, loaded from /logo.png.
 *
 * The artwork carries its own green-blue gradient, so it deliberately does not
 * follow the accent preference — a logo that changes colour stops reading as a
 * logo. The accent applies to the interface around it.
 *
 * If the file is missing the component renders a gradient monogram instead of
 * a broken-image icon, so a fresh clone without the asset still looks
 * deliberate rather than broken.
 */
export function HetexLogo({
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
        className={`bg-accent-gradient flex shrink-0 items-center justify-center rounded-xl font-semibold text-white ${className}`}
        style={{ width: size, height: size, fontSize: Math.round(size * 0.45) }}
        aria-label="Hetex AI"
        role="img"
      >
        H
      </span>
    );
  }

  return (
    <img
      src="/logo.png"
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
