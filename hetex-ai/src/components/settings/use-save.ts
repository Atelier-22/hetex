"use client";

import { useCallback, useRef, useState } from "react";
import type { SaveState } from "./primitives";

/**
 * Optimistic save with rollback.
 *
 * Applies the change locally at once, persists in the background, and puts the
 * old value back if the write fails — so a control never sits showing a state
 * the server rejected.
 */
export function useSave() {
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const run = useCallback(
    async (
      persist: () => Promise<unknown>,
      rollback?: () => void
    ): Promise<boolean> => {
      if (timer.current) clearTimeout(timer.current);
      setState("saving");
      setError(null);

      try {
        await persist();
        setState("saved");
        timer.current = setTimeout(() => setState("idle"), 2000);
        return true;
      } catch (err) {
        rollback?.();
        setState("error");
        setError(err instanceof Error ? err.message : "Could not save");
        // The error stays visible longer than a success: it needs reading.
        timer.current = setTimeout(() => setState("idle"), 5000);
        return false;
      }
    },
    []
  );

  return { state, error, run };
}
