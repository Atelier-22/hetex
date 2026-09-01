"use client";

// Navigation state for the settings interface: which section is open, what has
// been searched for, and — on a phone — whether the category list or a section
// is showing. Deliberately separate from the settings store, which holds the
// values themselves; opening a panel is not a preference.

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { SectionId } from "./registry";

type Ctx = {
  open: boolean;
  section: SectionId;
  query: string;
  /** Mobile only: the category list, or one section. */
  mobileView: "list" | "section";
  openSettings: (section?: SectionId) => void;
  closeSettings: () => void;
  setSection: (id: SectionId) => void;
  setQuery: (q: string) => void;
  backToList: () => void;
};

const SettingsUiContext = createContext<Ctx | null>(null);

export function SettingsUiProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [section, setSectionState] = useState<SectionId>("profile");
  const [query, setQuery] = useState("");
  const [mobileView, setMobileView] = useState<"list" | "section">("list");

  const openSettings = useCallback((next?: SectionId) => {
    if (next) {
      setSectionState(next);
      // Deep-linking to a section on a phone should land on that section, not
      // on the list with the section hidden behind it.
      setMobileView("section");
    } else {
      setMobileView("list");
    }
    setOpen(true);
  }, []);

  const closeSettings = useCallback(() => {
    setOpen(false);
    // Reopening starts clean rather than showing a filtered list with no memory
    // of why it was filtered.
    setQuery("");
    setMobileView("list");
  }, []);

  const setSection = useCallback((id: SectionId) => {
    setSectionState(id);
    setMobileView("section");
  }, []);

  const backToList = useCallback(() => setMobileView("list"), []);

  const value = useMemo(
    () => ({
      open,
      section,
      query,
      mobileView,
      openSettings,
      closeSettings,
      setSection,
      setQuery,
      backToList,
    }),
    [open, section, query, mobileView, openSettings, closeSettings, setSection, backToList]
  );

  return (
    <SettingsUiContext.Provider value={value}>
      {children}
    </SettingsUiContext.Provider>
  );
}

export function useSettingsUi() {
  const ctx = useContext(SettingsUiContext);
  if (!ctx) {
    throw new Error("useSettingsUi must be used inside SettingsUiProvider");
  }
  return ctx;
}
