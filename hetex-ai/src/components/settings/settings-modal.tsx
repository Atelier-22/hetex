"use client";

import { useEffect, useMemo, useRef } from "react";
import { ArrowLeft, Search, X } from "lucide-react";
import { useSettingsUi } from "./settings-context";
import {
  CATEGORIES,
  SECTION_BY_ID,
  searchSections,
  type CategoryId,
  type SectionDef,
  type SectionId,
} from "./registry";
import { useSettingsStore } from "@/lib/settings/store";

/**
 * The settings shell.
 *
 * Desktop and tablet: a nav column beside the content. Phone: the category list
 * *or* one section, with a back button — a 60-wide sidebar next to content on a
 * 360px screen leaves neither usable.
 */
export function SettingsModal({
  renderSection,
}: {
  renderSection: (id: SectionId) => React.ReactNode;
}) {
  const {
    open,
    section,
    query,
    mobileView,
    closeSettings,
    setSection,
    setQuery,
    backToList,
  } = useSettingsUi();
  const { localOnlyPersistence } = useSettingsStore();

  const searchRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusTo = useRef<HTMLElement | null>(null);

  const hits = useMemo(() => searchSections(query), [query]);
  const searching = query.trim().length > 0;

  // Escape closes from anywhere inside the dialog, including while a control
  // has focus. On a phone showing a section, it goes back to the list first.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      const narrow = window.matchMedia("(max-width: 767px)").matches;
      if (narrow && mobileView === "section") backToList();
      else closeSettings();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, mobileView, backToList, closeSettings]);

  // The page behind a modal should not scroll with it.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Focus goes into the dialog on open and back where it came from on close —
  // otherwise a keyboard user is returned to the top of the document.
  useEffect(() => {
    if (open) {
      restoreFocusTo.current = document.activeElement as HTMLElement | null;
      searchRef.current?.focus();
    } else {
      restoreFocusTo.current?.focus?.();
    }
  }, [open]);

  // Tab must not escape into the page behind. Cycled manually because the
  // panel is a portal-less overlay over live content.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab" || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Changing section should start at the top of the new one, not halfway down
  // where the last one was scrolled to.
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
  }, [section]);

  // Searching should move you to what you found, not leave you on a section the
  // filtered nav no longer lists.
  useEffect(() => {
    if (!searching) return;
    if (hits.length > 0 && !hits.some((h) => h.section.id === section)) {
      setSection(hits[0].section.id);
    }
  }, [searching, hits, section, setSection]);

  if (!open) return null;

  const active = SECTION_BY_ID.get(section);

  const grouped = CATEGORIES.map((category) => ({
    category,
    items: hits
      .filter((h) => h.section.category === category.id)
      .map((h) => h.section),
  })).filter((g) => g.items.length > 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-[3px]"
        onClick={closeSettings}
        aria-hidden
      />

      <div
        ref={panelRef}
        className="settings-panel relative flex h-full w-full flex-col overflow-hidden border-[var(--border-subtle)] sm:h-[min(48rem,92vh)] sm:max-w-5xl sm:rounded-2xl sm:border md:flex-row"
      >
        {/* ---- Navigation ---- */}
        <aside
          className={`flex min-h-0 shrink-0 flex-col border-[var(--border-subtle)] md:w-64 md:border-r ${
            mobileView === "section" ? "hidden md:flex" : "flex"
          }`}
        >
          <div className="flex items-center gap-2 px-3 pb-1 pt-3.5">
            <button
              onClick={closeSettings}
              aria-label="Close settings"
              className="focus-ring flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
            >
              <X size={17} />
            </button>
            <h1 className="text-base font-semibold">Settings</h1>
          </div>

          <div className="px-3 py-2">
            <label className="sr-only" htmlFor="settings-search">
              Search settings
            </label>
            <div className="focus-within-accent flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2.5 py-2">
              <Search size={14} className="shrink-0 text-[var(--text-secondary)]" />
              <input
                id="settings-search"
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search settings"
                type="search"
                autoComplete="off"
                className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--text-secondary)]"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="focus-ring shrink-0 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {localOnlyPersistence && (
            <p className="mx-3 mb-2 rounded-lg border border-[var(--border-subtle)] px-2.5 py-2 text-[11px] leading-relaxed text-[var(--text-secondary)]">
              You are signed out. Changes are saved in this browser only, and are
              offered to your account when you sign in.
            </p>
          )}

          <nav
            aria-label="Settings sections"
            className="min-h-0 flex-1 overflow-y-auto px-2 pb-4"
          >
            {grouped.map(({ category, items }) => (
              <NavGroup
                key={category.id}
                label={category.label}
                items={items}
                active={section}
                onSelect={setSection}
                hitMatches={hits}
                searching={searching}
              />
            ))}

            {grouped.length === 0 && (
              <p className="px-2.5 py-4 text-xs leading-relaxed text-[var(--text-secondary)]">
                Nothing in settings matches “{query}”.
              </p>
            )}
          </nav>
        </aside>

        {/* ---- Content ---- */}
        <div
          className={`min-h-0 min-w-0 flex-1 flex-col ${
            mobileView === "section" ? "flex" : "hidden md:flex"
          }`}
        >
          <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-3 py-2.5 md:hidden">
            <button
              onClick={backToList}
              className="focus-ring flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
            >
              <ArrowLeft size={16} />
              Settings
            </button>
            <span className="ml-auto truncate text-sm font-medium">
              {active?.label}
            </span>
            <button
              onClick={closeSettings}
              aria-label="Close settings"
              className="focus-ring flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
            >
              <X size={17} />
            </button>
          </div>

          <div ref={contentRef} className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-2xl px-4 py-6 sm:px-8 sm:py-8">
              {active ? (
                renderSection(active.id)
              ) : (
                <p className="text-sm text-[var(--text-secondary)]">
                  Select a section.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NavGroup({
  label,
  items,
  active,
  onSelect,
  hitMatches,
  searching,
}: {
  label: string;
  items: SectionDef[];
  active: SectionId;
  onSelect: (id: SectionId) => void;
  hitMatches: { section: SectionDef; matches: string[] }[];
  searching: boolean;
}) {
  return (
    <div className="mb-3 last:mb-0">
      <h2 className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
        {label}
      </h2>
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.id;
        // When searching, show which controls inside matched — otherwise a hit
        // on "speech speed" looks like an unexplained hit on "Voice".
        const matches =
          searching
            ? hitMatches.find((h) => h.section.id === item.id)?.matches ?? []
            : [];

        return (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            aria-current={isActive ? "page" : undefined}
            className={`settings-nav-item focus-ring flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
              isActive
                ? "bg-accent-soft font-medium"
                : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
            }`}
          >
            <Icon size={15} className="mt-0.5 shrink-0" />
            <span className="min-w-0">
              <span className="block truncate">{item.label}</span>
              {matches.length > 0 && (
                <span className="mt-0.5 block truncate text-[11px] opacity-75">
                  {matches.join(" · ")}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
