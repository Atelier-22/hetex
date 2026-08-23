"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

export const SECTION_IDS = [
  "general",
  "notifications",
  "personalization",
  "plugins",
  "voice",
  "billing",
  "data-controls",
  "storage",
  "security",
  "account",
  "keyboard",
] as const;

export type SectionId = (typeof SECTION_IDS)[number];

type Ctx = {
  open: boolean;
  section: SectionId;
  query: string;
  openSettings: (section?: SectionId) => void;
  closeSettings: () => void;
  setSection: (id: SectionId) => void;
  setQuery: (q: string) => void;
};

const SettingsContext = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [section, setSectionState] = useState<SectionId>("general");
  const [query, setQuery] = useState("");

  const openSettings = useCallback((next?: SectionId) => {
    if (next) setSectionState(next);
    setOpen(true);
  }, []);

  const closeSettings = useCallback(() => {
    setOpen(false);
    // Clearing the search on close means reopening starts clean rather than
    // showing a filtered nav with no memory of why.
    setQuery("");
  }, []);

  const setSection = useCallback((id: SectionId) => setSectionState(id), []);

  const value = useMemo(
    () => ({
      open,
      section,
      query,
      openSettings,
      closeSettings,
      setSection,
      setQuery,
    }),
    [open, section, query, openSettings, closeSettings, setSection]
  );

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useSettings must be used inside SettingsProvider");
  }
  return ctx;
}
