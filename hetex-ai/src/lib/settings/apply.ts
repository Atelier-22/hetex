// Hetex AI — applying settings to the live document.
//
// Every appearance and accessibility setting becomes a data-attribute on <html>
// and is styled from globals.css. Doing it this way rather than through React
// props means a change takes effect everywhere at once — including inside
// portals, the settings modal itself, and anything rendered before hydration.

import type { UserSettings } from "./types";

/**
 * The custom accent, as the four shades the palette needs.
 *
 * Derived from one hex value rather than asking for four, because nobody wants
 * to pick four colours. The lighter/darker steps are computed in sRGB, which is
 * crude but predictable; the "soft" background is the hue at low opacity so it
 * works on both a light and a dark surface.
 */
export function accentShades(hex: string): Record<string, string> {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);

  if ([r, g, b].some(Number.isNaN)) return {};

  const mix = (channel: number, target: number, amount: number) =>
    Math.round(channel + (target - channel) * amount);

  const toHex = (rr: number, gg: number, bb: number) =>
    `#${[rr, gg, bb].map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, "0")).join("")}`;

  const lighter = toHex(mix(r, 255, 0.35), mix(g, 255, 0.35), mix(b, 255, 0.35));
  const darker = toHex(mix(r, 0, 0.2), mix(g, 0, 0.2), mix(b, 0, 0.2));

  // Relative luminance, to decide whether text on the soft tint should be the
  // dark or the light end. A fixed choice fails for half of all hues.
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return {
    "--accent-from": hex,
    "--accent-to": lighter,
    "--accent-solid": hex,
    "--accent-strong": darker,
    "--accent-soft": `rgba(${r}, ${g}, ${b}, 0.16)`,
    "--accent-on-soft": luminance > 0.6 ? darker : hex,
  };
}

const CUSTOM_ACCENT_VARS = [
  "--accent-from",
  "--accent-to",
  "--accent-solid",
  "--accent-strong",
  "--accent-soft",
  "--accent-on-soft",
];

/**
 * Which text-size step is in effect.
 *
 * Accessibility overrides Appearance rather than sitting beside it: someone who
 * has switched on "Large text" has said something about their eyes, and it
 * should not be quietly undone by a font-size dropdown they set months ago.
 */
export function effectiveFontSize(settings: UserSettings): string {
  if (settings.accessibility.extraLargeText) return "xlarge";
  if (settings.accessibility.largeText) {
    return settings.appearance.fontSize === "xlarge" ? "xlarge" : "large";
  }
  return settings.appearance.fontSize;
}

/**
 * Whether motion should be suppressed.
 *
 * The OS-level `prefers-reduced-motion` is handled in CSS and is not overridden
 * here — a system setting that says "no motion" is not something an app should
 * argue with. This only adds reasons to reduce, never removes them.
 */
export function effectiveAnimations(settings: UserSettings): string {
  if (settings.accessibility.reduceMotion) return "off";
  return settings.appearance.animations;
}

/** Applies everything that lives on the document element. */
export function applySettingsToDocument(settings: UserSettings): void {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const a = settings.appearance;
  const acc = settings.accessibility;

  root.dataset.accent = a.accent;
  root.dataset.visualStyle = a.visualStyle;
  root.dataset.background = a.background;
  root.dataset.animations = effectiveAnimations(settings);
  root.dataset.density = a.messageDensity;
  root.dataset.bubble = a.bubbleStyle;
  root.dataset.textSize = effectiveFontSize(settings);
  root.dataset.codeSize = a.codeFontSize;
  root.dataset.lineSpacing = a.lineSpacing;

  root.dataset.contrast = acc.highContrast ? "high" : "normal";
  root.dataset.boldText = acc.boldText ? "on" : "off";
  root.dataset.largeTargets = acc.largerButtons ? "on" : "off";

  // AMOLED is dark plus true black. next-themes owns the `dark` class; this
  // attribute only changes which dark palette is used.
  root.dataset.amoled = a.theme === "amoled" ? "on" : "off";

  if (a.accent === "custom" && a.customAccent) {
    for (const [name, value] of Object.entries(accentShades(a.customAccent))) {
      root.style.setProperty(name, value);
    }
  } else {
    // Removed rather than overwritten, so the stylesheet's own values apply.
    for (const name of CUSTOM_ACCENT_VARS) root.style.removeProperty(name);
  }

  // The AI response language is what the model answers in; the document's lang
  // attribute is what a screen reader pronounces. Only set it when a specific
  // language was chosen — "auto" means "whatever the user wrote".
  const aiLang = settings.language.aiResponse;
  root.lang = aiLang && aiLang !== "auto" ? aiLang : "en";
}

/** What next-themes should be told, given a theme that includes AMOLED. */
export function themeForNextThemes(theme: UserSettings["appearance"]["theme"]): string {
  return theme === "amoled" ? "dark" : theme;
}
