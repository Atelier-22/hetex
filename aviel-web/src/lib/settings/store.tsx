"use client";

// Aviel AI — the settings store.
//
// One place holds the settings document; everything in the app reads from here.
//
// Persistence, in order of authority:
//
//   signed in   the account, through GET/PATCH /settings. The server validates
//               every write and is the source of truth. A local cache is kept
//               so a reload paints the right theme before the network answers.
//   signed out  localStorage only. Appearance and accessibility still have to
//               work on the login screen, and there is no account to save to.
//
// Signing in merges: anything changed while signed out is offered to the
// account rather than silently dropped or silently overwriting what the account
// already had. See `syncLocalIntoAccount`.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTheme } from "next-themes";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/api-client";
import {
  DEFAULT_SETTINGS,
  mergeSettings,
  withDefaults,
  type SettingsGroup,
  type SettingsPatch,
  type UserSettings,
} from "./types";
import { applySettingsToDocument, themeForNextThemes } from "./apply";

const CACHE_KEY = "aviel.settings.v1";
/** Groups a signed-out visitor can meaningfully change, and which are offered on sign-in. */
const LOCAL_GROUPS: SettingsGroup[] = ["appearance", "accessibility"];

export type SaveState = "idle" | "saving" | "saved" | "error";

export interface SettingsMeta {
  version: string;
  build: string;
  models: {
    value: string;
    label: string;
    description: string;
    capabilities: { webSearch: boolean; images: boolean; temperature: boolean };
    provider: string;
    local: boolean;
  }[];
  providers: {
    id: string;
    label: string;
    vendor: string | null;
    configured: boolean;
    local: boolean;
    capabilities: { webSearch: boolean; images: boolean; temperature: boolean };
    models: { value: string; label: string; description: string }[];
  }[];
  localAI: {
    runtime: "ollama" | "llamacpp" | "none";
    available: boolean;
    manageable: boolean;
    version: string | null;
    modelCount: number;
    requirement: string | null;
  };
  notificationCategories: { id: string; label: string; description: string }[];
  notificationChannels: { value: string; label: string }[];
  notificationsDeliverable: boolean;
  memoryCategories: string[];
  interfaceLanguages: { value: string; label: string }[];
  interfaceTranslationsAvailable: boolean;
  aiLanguages: { value: string; label: string }[];
  features: Record<string, boolean>;
  limits: Record<string, number>;
  allowedFileTypes: string[];
  usage: {
    type: string;
    used: number;
    limit: number;
    remaining: number | null;
    exceeded: boolean;
  }[];
  plans: {
    id: string;
    name: string;
    description: string;
    priceLabel: string;
    available: boolean;
  }[];
  billingConfigured: boolean;
  capabilities: Record<string, boolean | string>;
  groups: SettingsGroup[];
  defaults: UserSettings;
}

interface Ctx {
  settings: UserSettings;
  meta: SettingsMeta | null;
  loaded: boolean;
  /** True while signed out — writes go to this browser only. */
  localOnlyPersistence: boolean;
  saveState: SaveState;
  error: string | null;
  update: (patch: SettingsPatch) => Promise<void>;
  reset: (group?: SettingsGroup) => Promise<void>;
  reload: () => Promise<void>;
  clearError: () => void;
}

const SettingsStore = createContext<Ctx | null>(null);

function readCache(): UserSettings | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? withDefaults(JSON.parse(raw)) : null;
  } catch {
    // Private mode, disabled storage, or a corrupted value. None is fatal.
    return null;
  }
}

function writeCache(settings: UserSettings): void {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(settings));
  } catch {
    // Nothing to do — the account copy is the one that matters.
  }
}

/** The subset of a local document worth offering to an account on sign-in. */
function localOverrides(local: UserSettings): SettingsPatch {
  const patch: SettingsPatch = {};
  for (const group of LOCAL_GROUPS) {
    const changed = Object.entries(local[group] as Record<string, unknown>).filter(
      ([key, value]) =>
        (DEFAULT_SETTINGS[group] as Record<string, unknown>)[key] !== value
    );
    if (changed.length > 0) {
      patch[group] = Object.fromEntries(changed) as never;
    }
  }
  return patch;
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const { setTheme } = useTheme();

  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [meta, setMeta] = useState<SettingsMeta | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncedFor = useRef<string | null>(null);

  /** Everything that has to happen when the document changes, in one place. */
  const applyEverywhere = useCallback(
    (next: UserSettings, persistLocally: boolean) => {
      applySettingsToDocument(next);
      setTheme(themeForNextThemes(next.appearance.theme));
      if (persistLocally) writeCache(next);
    },
    [setTheme]
  );

  // First paint: the cached document, so the theme does not flash. Corrected by
  // the account copy a moment later.
  useEffect(() => {
    const cached = readCache();
    if (cached) {
      setSettings(cached);
      applyEverywhere(cached, false);
    } else {
      applySettingsToDocument(DEFAULT_SETTINGS);
    }
  }, [applyEverywhere]);

  const signedIn = status === "authenticated" && Boolean(session);

  const load = useCallback(async () => {
    const [remote, remoteMeta] = await Promise.all([
      apiFetch<Partial<UserSettings>>("/settings"),
      apiFetch<SettingsMeta>("/settings/meta").catch(() => null),
    ]);

    const next = withDefaults(remote);
    setSettings(next);
    if (remoteMeta) setMeta(remoteMeta);
    applyEverywhere(next, true);
    return next;
  }, [applyEverywhere]);

  /**
   * Carry local changes into the account on first sign-in.
   *
   * Only groups the signed-out UI can actually change, and only keys that
   * differ from the defaults — so signing in on a second device does not push
   * that device's untouched defaults over what the account already has.
   */
  const syncLocalIntoAccount = useCallback(async () => {
    const local = readCache();
    if (!local) return;

    const patch = localOverrides(local);
    if (Object.keys(patch).length === 0) return;

    try {
      const saved = await apiFetch<UserSettings>("/settings", {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      const next = withDefaults(saved);
      setSettings(next);
      applyEverywhere(next, true);
    } catch {
      // The account copy already loaded and is correct; a failed merge is not
      // worth an error banner on the way in.
    }
  }, [applyEverywhere]);

  useEffect(() => {
    if (status === "loading") return;

    if (!signedIn) {
      // Signed out: whatever is cached, or the defaults.
      const cached = readCache() ?? DEFAULT_SETTINGS;
      setSettings(cached);
      applyEverywhere(cached, false);
      setLoaded(true);
      syncedFor.current = null;
      return;
    }

    let cancelled = false;
    setLoaded(false);

    load()
      .then(() => {
        if (cancelled) return;
        const key = session?.user?.email ?? "account";
        if (syncedFor.current !== key) {
          syncedFor.current = key;
          void syncLocalIntoAccount();
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? `Couldn't load your settings: ${err.message}`
            : "Couldn't load your settings"
        );
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [signedIn, status, session?.user?.email, load, syncLocalIntoAccount, applyEverywhere]);

  const flashSaved = useCallback((state: SaveState, ms: number) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState(state);
    saveTimer.current = setTimeout(() => setSaveState("idle"), ms);
  }, []);

  /**
   * Change a setting.
   *
   * Applies at once, saves in the background, and puts the old value back if
   * the write is refused — a control must never sit showing a state the server
   * rejected.
   */
  const update = useCallback(
    async (patch: SettingsPatch) => {
      const previous = settings;
      const next = mergeSettings(settings, patch);

      setSettings(next);
      applyEverywhere(next, true);
      setError(null);

      if (!signedIn) {
        // Nothing to save to. The local write above is the whole operation.
        flashSaved("saved", 1500);
        return;
      }

      if (saveTimer.current) clearTimeout(saveTimer.current);
      setSaveState("saving");

      try {
        const saved = await apiFetch<UserSettings>("/settings", {
          method: "PATCH",
          body: JSON.stringify(patch),
        });

        // The server may have clamped something — a feature an admin has since
        // turned off, or a value above a limit. Its answer wins.
        const confirmed = withDefaults(saved);
        setSettings(confirmed);
        applyEverywhere(confirmed, true);
        flashSaved("saved", 2000);
      } catch (err) {
        setSettings(previous);
        applyEverywhere(previous, true);
        setError(
          err instanceof Error ? err.message : "Couldn't save this setting."
        );
        // Longer than a success: it needs reading.
        flashSaved("error", 6000);
        throw err;
      }
    },
    [settings, signedIn, applyEverywhere, flashSaved]
  );

  const reset = useCallback(
    async (group?: SettingsGroup) => {
      if (!signedIn) {
        const next = group
          ? mergeSettings(settings, { [group]: DEFAULT_SETTINGS[group] } as SettingsPatch)
          : DEFAULT_SETTINGS;
        setSettings(next);
        applyEverywhere(next, true);
        flashSaved("saved", 1500);
        return;
      }

      setSaveState("saving");
      try {
        const saved = await apiFetch<UserSettings>("/settings/reset", {
          method: "POST",
          body: JSON.stringify(group ? { group } : {}),
        });
        const next = withDefaults(saved);
        setSettings(next);
        applyEverywhere(next, true);
        flashSaved("saved", 2000);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't reset those settings.");
        flashSaved("error", 6000);
        throw err;
      }
    },
    [signedIn, settings, applyEverywhere, flashSaved]
  );

  const reload = useCallback(async () => {
    if (!signedIn) return;
    await load();
  }, [signedIn, load]);

  const value = useMemo<Ctx>(
    () => ({
      settings,
      meta,
      loaded,
      localOnlyPersistence: !signedIn,
      saveState,
      error,
      update,
      reset,
      reload,
      clearError: () => setError(null),
    }),
    [settings, meta, loaded, signedIn, saveState, error, update, reset, reload]
  );

  return <SettingsStore.Provider value={value}>{children}</SettingsStore.Provider>;
}

export function useSettingsStore(): Ctx {
  const ctx = useContext(SettingsStore);
  if (!ctx) {
    throw new Error("useSettingsStore must be used inside SettingsProvider");
  }
  return ctx;
}

/** Read one group. The common case, and it re-renders on that group only. */
export function useSettingsGroup<K extends SettingsGroup>(
  group: K
): UserSettings[K] {
  return useSettingsStore().settings[group];
}
