"use client";

// Hetex AI — idle session timeout.
//
// Makes Security → "Sign out after inactivity" a real thing rather than a
// stored number: after the chosen period with no interaction, the session is
// ended and the browser is returned to the sign-in page.
//
// This is a convenience control, not a security boundary — the bearer token
// remains valid until it expires or is revoked, which is what the Devices list
// is for. It is described that way in the UI rather than oversold.

import { useEffect, useRef } from "react";
import { signOut, useSession } from "next-auth/react";
import { useSettingsGroup } from "@/lib/settings/store";

const ACTIVITY_EVENTS = [
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
  "visibilitychange",
] as const;

/** How close to the deadline a warning appears. */
const WARN_MS = 60_000;

export function IdleTimeout() {
  const { status } = useSession();
  const { sessionTimeoutMinutes } = useSettingsGroup("security");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (status !== "authenticated" || sessionTimeoutMinutes <= 0) return;

    const limitMs = sessionTimeoutMinutes * 60_000;

    const clear = () => {
      if (timer.current) clearTimeout(timer.current);
      if (warnTimer.current) clearTimeout(warnTimer.current);
    };

    const arm = () => {
      clear();

      if (limitMs > WARN_MS) {
        warnTimer.current = setTimeout(() => {
          // A silent sign-out mid-sentence is indistinguishable from a crash.
          console.info("Hetex: signing out in a minute due to inactivity");
        }, limitMs - WARN_MS);
      }

      timer.current = setTimeout(() => {
        void signOut({ callbackUrl: "/login?reason=idle" });
      }, limitMs);
    };

    arm();
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, arm, { passive: true });
    }

    return () => {
      clear();
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, arm);
      }
    };
  }, [status, sessionTimeoutMinutes]);

  return null;
}
