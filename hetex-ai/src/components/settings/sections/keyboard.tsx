"use client";

import { useEffect, useState } from "react";
import { SectionHeader } from "../primitives";
import { usePreferences } from "../../preferences";

/**
 * Read-only reference. Every shortcut listed is one the app actually handles —
 * documenting keys that do nothing is worse than documenting none.
 */
type Shortcut = {
  keys: string[];
  action: string;
  /** Only listed when the matching setting is in that state. */
  conditional?: "enterToSend" | "!enterToSend";
};

const GROUPS: { title: string; items: Shortcut[] }[] = [
  {
    title: "Composer",
    items: [
      { keys: ["Enter"], action: "Send message", conditional: "enterToSend" },
      { keys: ["Shift", "Enter"], action: "New line", conditional: "enterToSend" },
      { keys: ["Enter"], action: "New line", conditional: "!enterToSend" },
    ],
  },
  {
    title: "Navigation",
    items: [{ keys: ["Esc"], action: "Close settings, or any open menu" }],
  },
];

export function KeyboardSection() {
  const { prefs } = usePreferences();
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/i.test(navigator.userAgent));
  }, []);

  return (
    <>
      <SectionHeader
        title="Keyboard"
        description="Shortcuts available in Hetex."
      />

      {GROUPS.map((group) => (
        <div key={group.title} className="mb-6 last:mb-0">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
            {group.title}
          </h3>
          <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)]">
            {group.items
              .filter((item) => {
                // The composer's Enter behaviour depends on a setting, so only
                // the binding that is actually live is listed.
                if (item.conditional === "enterToSend") return prefs.enterToSend;
                if (item.conditional === "!enterToSend") return !prefs.enterToSend;
                return true;
              })
              .map((item) => (
                <div
                  key={`${item.action}-${item.keys.join()}`}
                  className="flex items-center justify-between gap-4 border-b border-[var(--border-subtle)] px-4 py-2.5 last:border-b-0"
                >
                  <span className="text-sm text-[var(--text-secondary)]">
                    {item.action}
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    {item.keys.map((k) => (
                      <kbd
                        key={k}
                        className="rounded border border-[var(--border-subtle)] bg-black/[0.03] px-2 py-0.5 font-mono text-xs dark:bg-white/[0.05]"
                      >
                        {k === "Mod" ? (isMac ? "⌘" : "Ctrl") : k}
                      </kbd>
                    ))}
                  </span>
                </div>
              ))}
          </div>
        </div>
      ))}

      <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
        Only shortcuts Hetex actually handles are listed. Whether Enter sends or
        adds a new line is set in Personalization.
      </p>
    </>
  );
}
