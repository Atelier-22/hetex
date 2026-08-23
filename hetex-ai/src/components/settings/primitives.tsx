"use client";

import { Check, Loader2, AlertCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Shared building blocks so every settings section looks like the same product.
 *
 * Each row carries a `label` that the settings search matches against, which is
 * why the label is a required string rather than arbitrary children.
 */

export type SaveState = "idle" | "saving" | "saved" | "error";

export function SectionHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      {description && (
        <p className="mt-1 text-sm text-[var(--text-secondary)]">{description}</p>
      )}
    </div>
  );
}

/** A labelled row with its control on the right. The standard settings shape. */
export function SettingsRow({
  label,
  description,
  icon: Icon,
  children,
  hidden,
}: {
  label: string;
  description?: React.ReactNode;
  icon?: LucideIcon;
  children?: React.ReactNode;
  hidden?: boolean;
}) {
  if (hidden) return null;

  return (
    <div className="flex items-start justify-between gap-6 border-b border-[var(--border-subtle)] py-3.5 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm">
          {Icon && (
            <Icon size={14} className="shrink-0 text-[var(--text-secondary)]" />
          )}
          <span>{label}</span>
        </div>
        {description && (
          <div className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
            {description}
          </div>
        )}
      </div>
      {children && <div className="shrink-0 pt-0.5">{children}</div>}
    </div>
  );
}

/** A full-width block for controls too big to sit beside a label. */
export function SettingsBlock({
  label,
  description,
  children,
  hidden,
}: {
  label: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  hidden?: boolean;
}) {
  if (hidden) return null;

  return (
    <div className="border-b border-[var(--border-subtle)] py-4 last:border-b-0">
      <p className="text-sm">{label}</p>
      {description && (
        <div className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
          {description}
        </div>
      )}
      <div className="mt-3">{children}</div>
    </div>
  );
}

export function SettingsToggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        checked ? "bg-accent-gradient" : "bg-black/15 dark:bg-white/15"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

export function SettingsDropdown<T extends string>({
  value,
  onChange,
  options,
  disabled,
  label,
  className = "",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  disabled?: boolean;
  label: string;
  className?: string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as T)}
      className={`focus-accent min-w-[9rem] rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2.5 py-1.5 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** −/+/Reset stepper, for values that are a small ordered set. */
export function SettingsStepper({
  value,
  options,
  onChange,
  defaultValue,
  label,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  defaultValue: string;
  label: string;
}) {
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value)
  );
  const current = options[index] ?? options[0];

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        disabled={index <= 0}
        onClick={() => onChange(options[index - 1].value)}
        className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border-subtle)] text-sm disabled:opacity-30"
      >
        −
      </button>
      <span className="min-w-[4.5rem] text-center text-sm">{current.label}</span>
      <button
        type="button"
        aria-label={`Increase ${label}`}
        disabled={index >= options.length - 1}
        onClick={() => onChange(options[index + 1].value)}
        className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border-subtle)] text-sm disabled:opacity-30"
      >
        +
      </button>
      <button
        type="button"
        onClick={() => onChange(defaultValue)}
        disabled={value === defaultValue}
        className="ml-1 rounded-md px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-black/5 disabled:opacity-30 dark:hover:bg-white/5"
      >
        Reset
      </button>
    </div>
  );
}

export function SettingsButton({
  children,
  onClick,
  variant = "default",
  disabled,
  busy,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "default" | "primary" | "danger";
  disabled?: boolean;
  busy?: boolean;
}) {
  const styles =
    variant === "primary"
      ? "bg-accent-gradient text-white"
      : variant === "danger"
        ? "border border-hetex-red-500/40 text-hetex-red-500 hover:bg-hetex-red-500/10"
        : "border border-[var(--border-subtle)] hover:bg-black/5 dark:hover:bg-white/5";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-opacity disabled:cursor-not-allowed disabled:opacity-50 ${styles}`}
    >
      {busy && <Loader2 size={13} className="animate-spin" />}
      {children}
    </button>
  );
}

/** Inline save feedback, so a control never changes silently. */
export function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "idle") return null;

  const map = {
    saving: { icon: Loader2, text: "Saving…", cls: "text-[var(--text-secondary)]", spin: true },
    saved: { icon: Check, text: "Saved", cls: "text-accent", spin: false },
    error: { icon: AlertCircle, text: "Not saved", cls: "text-hetex-red-500", spin: false },
  } as const;

  const { icon: Icon, text, cls, spin } = map[state];

  return (
    <span className={`flex items-center gap-1 text-xs ${cls}`} role="status">
      <Icon size={12} className={spin ? "animate-spin" : ""} />
      {text}
    </span>
  );
}

/** Marks a control whose backing feature isn't built yet. */
export function NotWiredBadge({ children }: { children?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--text-secondary)]">
      {children ?? "Not active yet"}
    </span>
  );
}
