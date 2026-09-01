import type { UserSettings } from "@/lib/settings/types";

/**
 * The composer's placeholder text.
 *
 * Uses the preferred name if one is set, then the display name. It never
 * invents a name and never hardcodes one: an account with nothing set gets the
 * neutral prompt rather than a greeting addressed to "undefined".
 *
 * Kept in its own module, free of JSX, so it can be tested directly.
 */
export function composerPlaceholder(settings: UserSettings): string {
  const name =
    settings.profile.preferredName?.trim() ||
    settings.profile.displayName?.trim();

  if (!name) return "Ask Aviel anything…";

  // Only the first word: "Muhwezi Peter" becomes "Muhwezi", which is what a
  // greeting wants rather than the full legal name.
  return `How can I help you, ${name.split(/\s+/)[0]}?`;
}
