"use client";

// The plumbing every section needs: read its group, write one key, show the
// save state, reset the section. Kept in one hook so twenty-five sections do
// not each invent their own optimistic-update-with-rollback.

import { useCallback, useState } from "react";
import { useSettingsStore } from "@/lib/settings/store";
import type { SettingsGroup, UserSettings } from "@/lib/settings/types";

export function useSection<K extends SettingsGroup>(group: K) {
  const store = useSettingsStore();
  const [resetting, setResetting] = useState(false);

  const values = store.settings[group];

  /**
   * Change one or more keys in this group.
   *
   * Rejections are swallowed here because the store has already rolled the
   * value back and put the message in `error` — every section renders that in
   * one place, and an unhandled rejection per control is just noise.
   */
  const set = useCallback(
    (patch: Partial<UserSettings[K]>) => {
      void store.update({ [group]: patch } as never).catch(() => {});
    },
    [store, group]
  );

  const reset = useCallback(async () => {
    setResetting(true);
    try {
      await store.reset(group);
    } catch {
      // Reported through store.error.
    } finally {
      setResetting(false);
    }
  }, [store, group]);

  return {
    values,
    set,
    reset,
    resetting,
    settings: store.settings,
    meta: store.meta,
    saveState: store.saveState,
    error: store.error,
    loaded: store.loaded,
    localOnly: store.localOnlyPersistence,
    update: store.update,
    reload: store.reload,
    clearError: store.clearError,
  };
}

/** A section with no single backing group (Help, About, Integrations…). */
export function useSectionShell() {
  const store = useSettingsStore();
  return {
    settings: store.settings,
    meta: store.meta,
    saveState: store.saveState,
    error: store.error,
    loaded: store.loaded,
    localOnly: store.localOnlyPersistence,
    update: store.update,
    reload: store.reload,
  };
}
