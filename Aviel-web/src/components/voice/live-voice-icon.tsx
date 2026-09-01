// Aviel — the live voice mark.
//
// Five bars of varying height. This is the symbol for live voice everywhere it
// appears: the composer's action button, the Live Voice settings section, and
// anywhere else the mode is referenced. One mark, so tapping it always means
// the same thing.
//
// Deliberately not a microphone. The microphone means "speak instead of
// typing" — dictation, which puts text in the box. This means "go live", which
// is a different mode entirely, and giving them the same icon is what made the
// two impossible to tell apart.
//
// Props match lucide's shape (`size`, `className`, `strokeWidth`) so it can be
// used wherever a lucide icon is expected.

const BARS = [0.42, 0.78, 1, 0.62, 0.34];

export function LiveVoiceIcon({
  size = 24,
  className = "",
  /** Accepted for lucide compatibility; the bars are filled, not stroked. */
  strokeWidth: _strokeWidth,
}: {
  size?: number | string;
  className?: string;
  strokeWidth?: number | string;
}) {
  const n = typeof size === "string" ? parseFloat(size) : size;
  const w = n / 9;
  const gap = (n - BARS.length * w) / (BARS.length - 1);

  return (
    <svg
      width={n}
      height={n}
      viewBox={`0 0 ${n} ${n}`}
      fill="none"
      className={className}
      aria-hidden
      focusable="false"
    >
      {BARS.map((h, i) => {
        const barH = n * 0.72 * h;
        return (
          <rect
            key={i}
            x={i * (w + gap)}
            y={(n - barH) / 2}
            width={w}
            height={barH}
            rx={w / 2}
            fill="currentColor"
          />
        );
      })}
    </svg>
  );
}
