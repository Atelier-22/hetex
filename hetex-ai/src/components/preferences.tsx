"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useTheme } from "next-themes";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/api-client";

export type Preferences = {
  theme: string;
  accentColor: string;
  textSize: string;
  assistantName: string;
  responseStyle: string;
  model: string;
  memoryEnabled: boolean;
  enterToSend: boolean;
  dictationEnabled: boolean;
  voiceName: string | null;
};

const DEFAULTS: Preferences = {
  theme: "system",
  accentColor: "green",
  textSize: "medium",
  assistantName: "Hetex AI",
  responseStyle: "balanced",
  model: "claude-sonnet-4-6",
  memoryEnabled: false,
  enterToSend: true,
  dictationEnabled: true,
  voiceName: null,
};

type Ctx = {
  prefs: Preferences;
  loaded: boolean;
  /** Applies immediately, saves in the background, reverts if the save fails. */
  update: (patch: Partial<Preferences>) => Promise<void>;
  error: string | null;
};

const PreferencesContext = createContext<Ctx>({
  prefs: DEFAULTS,
  loaded: false,
  update: async () => {},
  error: null,
});

/** Appearance settings that are only useful applied to the whole document. */
function applyToDocument(prefs: Preferences) {
  const root = document.documentElement;
  root.dataset.accent = prefs.accentColor;
  root.dataset.textSize = prefs.textSize;
}

export function PreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const { setTheme } = useTheme();
  const [prefs, setPrefs] = useState<Preferences>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "loading") return;

    if (!session) {
      // Signed out — the login and register screens still need a sane palette.
      applyToDocument(DEFAULTS);
      setLoaded(true);
      return;
    }

    apiFetch<Partial<Preferences>>("/settings")
      .then((s) => {
        const merged = { ...DEFAULTS, ...s } as Preferences;
        setPrefs(merged);
        applyToDocument(merged);
        // next-themes owns the light/dark class; the account is the source of
        // truth for which one, so the choice follows you between devices.
        if (merged.theme) setTheme(merged.theme);
      })
      .catch(() => applyToDocument(DEFAULTS))
      .finally(() => setLoaded(true));
  }, [session, status, setTheme]);

  const update = useCallback(
    async (patch: Partial<Preferences>) => {
      const previous = prefs;
      const next = { ...prefs, ...patch };

      setPrefs(next);
      applyToDocument(next);
      if (patch.theme) setTheme(patch.theme);
      setError(null);

      try {
        await apiFetch("/settings", {
          method: "PATCH",
          body: JSON.stringify(patch),
        });
      } catch (err) {
        // Put the UI back rather than leaving it showing a preference the
        // server never accepted.
        setPrefs(previous);
        applyToDocument(previous);
        if (patch.theme) setTheme(previous.theme);
        setError(
          err instanceof Error ? err.message : "Could not save that setting"
        );
      }
    },
    [prefs, setTheme]
  );

  return (
    <PreferencesContext.Provider value={{ prefs, loaded, update, error }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  return useContext(PreferencesContext);
}
