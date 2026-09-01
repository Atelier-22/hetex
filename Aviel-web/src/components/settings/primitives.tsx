"use client";

// Shared building blocks, so every settings section looks like one product.
//
// Two rules run through all of them:
//
//   * Every control has an accessible name, a visible focus ring, and reaches
//     its state through the keyboard. `label` is required, not optional.
//   * A control whose backing feature does not exist is rendered disabled with
//     the reason stated, never hidden and never left looking operable.

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronRight,
  Info,
  Loader2,
  RotateCcw,
} from "lucide-react";
import type { SectionIcon } from "./registry";

export type SaveState = "idle" | "saving" | "saved" | "error";

/* -------------------------------------------------------------------------- */
/* Layout                                                                     */
/* -------------------------------------------------------------------------- */

export function SectionHeader({
  title,
  description,
  onReset,
  resetting,
}: {
  title: string;
  description?: string;
  /** Omitted for sections that hold no resettable preference. */
  onReset?: () => void;
  resetting?: boolean;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-[1.35rem] font-semibold tracking-[-0.01em]">{title}</h2>
        {description && (
          <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">
            {description}
          </p>
        )}
      </div>
      {onReset && (
        <button
          type="button"
          onClick={onReset}
          disabled={resetting}
          className="focus-ring mt-1 flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-2.5 py-1.5 text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] disabled:opacity-50"
        >
          {resetting ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <RotateCcw size={12} />
          )}
          Reset section
        </button>
      )}
    </div>
  );
}

/** A titled group of rows. The main structural unit inside a section. */
export function SettingsCard({
  title,
  description,
  children,
  footer,
}: {
  title?: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <section className="settings-card mb-4">
      {(title || description) && (
        <header className="border-b border-[var(--border-subtle)] px-4 py-3 sm:px-5">
          {title && <h3 className="text-sm font-semibold">{title}</h3>}
          {description && (
            <div className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
              {description}
            </div>
          )}
        </header>
      )}
      <div className="px-4 sm:px-5">{children}</div>
      {footer && (
        <footer className="border-t border-[var(--border-subtle)] px-4 py-3 sm:px-5">
          {footer}
        </footer>
      )}
    </section>
  );
}

/** A labelled row with its control on the right. */
export function SettingsRow({
  label,
  description,
  icon: Icon,
  children,
  hidden,
  unavailable,
}: {
  label: string;
  description?: React.ReactNode;
  icon?: SectionIcon;
  children?: React.ReactNode;
  hidden?: boolean;
  /** Why this control cannot be used. Rendered under the label. */
  unavailable?: string | null;
}) {
  if (hidden) return null;

  return (
    <div className="flex flex-col gap-3 border-b border-[var(--border-subtle)] py-4 last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm font-medium">
          {Icon && (
            <Icon size={14} className="shrink-0 text-[var(--text-secondary)]" />
          )}
          <span>{label}</span>
        </div>
        {description && (
          <div className="mt-1.5 text-xs leading-relaxed text-[var(--text-secondary)]">
            {description}
          </div>
        )}
        {unavailable && (
          <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-relaxed text-[var(--text-secondary)]">
            <Info size={12} className="mt-0.5 shrink-0" />
            {unavailable}
          </p>
        )}
      </div>
      {children && (
        <div className="shrink-0 self-start sm:pt-0.5">{children}</div>
      )}
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
  label?: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  hidden?: boolean;
}) {
  if (hidden) return null;

  return (
    <div className="border-b border-[var(--border-subtle)] py-4 last:border-b-0">
      {label && <p className="text-sm font-medium">{label}</p>}
      {description && (
        <div className="mt-1.5 text-xs leading-relaxed text-[var(--text-secondary)]">
          {description}
        </div>
      )}
      <div className={label || description ? "mt-3" : ""}>{children}</div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Controls                                                                   */
/* -------------------------------------------------------------------------- */

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
      className={`focus-ring relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        checked ? "bg-accent-gradient" : "bg-black/15 dark:bg-white/15"
      }`}
    >
      <span
        className={`pointer-events-none absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
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
  options: { value: T; label: string; disabled?: boolean }[];
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
      className={`focus-ring min-w-[10rem] max-w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2.5 py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} disabled={o.disabled}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Two to four mutually exclusive choices, shown side by side. */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
  disabled,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
  disabled?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-0.5"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={`focus-ring rounded-[0.35rem] px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              active
                ? "bg-accent-soft"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Larger choices that need a description each. */
export function OptionCards<T extends string>({
  value,
  onChange,
  options,
  label,
  columns = 1,
}: {
  value: T;
  onChange: (v: T) => void;
  options: {
    value: T;
    label: string;
    description?: React.ReactNode;
    badge?: React.ReactNode;
    disabled?: boolean;
    disabledReason?: string;
  }[];
  label: string;
  columns?: 1 | 2;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`grid gap-2 ${columns === 2 ? "sm:grid-cols-2" : ""}`}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={o.disabled}
            title={o.disabled ? o.disabledReason : undefined}
            onClick={() => !o.disabled && onChange(o.value)}
            className={`focus-ring rounded-xl border px-3.5 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              active
                ? "border-accent bg-accent-soft"
                : "border-[var(--border-subtle)] hover:bg-[var(--surface-hover)]"
            }`}
          >
            <span className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">{o.label}</span>
              {o.badge ??
                (active && (
                  <Check size={14} className="shrink-0" aria-hidden />
                ))}
            </span>
            {o.description && (
              <span className="mt-1 block text-xs leading-relaxed text-[var(--text-secondary)]">
                {o.description}
              </span>
            )}
            {o.disabled && o.disabledReason && (
              <span className="mt-1.5 block text-xs leading-relaxed text-[var(--text-secondary)]">
                {o.disabledReason}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * A numeric slider.
 *
 * Commits on release rather than on every pixel of drag: each change is a
 * network write, and dragging from 0.5 to 2.0 should be one save, not forty.
 */
export function SettingsSlider({
  value,
  onCommit,
  min,
  max,
  step,
  label,
  format,
  disabled,
}: {
  value: number;
  onCommit: (v: number) => void;
  min: number;
  max: number;
  step: number;
  label: string;
  format?: (v: number) => string;
  disabled?: boolean;
}) {
  const [local, setLocal] = useState(value);

  // Follow the stored value when it changes elsewhere — a reset, or the server
  // clamping what was sent.
  useEffect(() => setLocal(value), [value]);

  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={local}
        disabled={disabled}
        onChange={(e) => setLocal(Number(e.target.value))}
        onPointerUp={() => local !== value && onCommit(local)}
        onKeyUp={() => local !== value && onCommit(local)}
        onBlur={() => local !== value && onCommit(local)}
        className="settings-slider focus-ring h-1.5 w-36 cursor-pointer appearance-none rounded-full bg-black/10 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white/15"
      />
      <span className="min-w-[3rem] text-right font-mono text-xs tabular-nums text-[var(--text-secondary)]">
        {(format ?? ((v: number) => String(v)))(local)}
      </span>
    </div>
  );
}

export function TextField({
  value,
  onCommit,
  label,
  placeholder,
  type = "text",
  disabled,
  maxLength,
  inputMode,
  autoComplete,
  error,
  className = "",
}: {
  value: string;
  onCommit: (v: string) => void;
  label: string;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  maxLength?: number;
  inputMode?: "text" | "tel" | "email" | "numeric";
  autoComplete?: string;
  error?: string | null;
  className?: string;
}) {
  const [local, setLocal] = useState(value);
  const committed = useRef(value);

  useEffect(() => {
    setLocal(value);
    committed.current = value;
  }, [value]);

  const commit = () => {
    if (local === committed.current) return;
    committed.current = local;
    onCommit(local);
  };

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <input
        type={type}
        aria-label={label}
        aria-invalid={error ? true : undefined}
        placeholder={placeholder}
        value={local}
        disabled={disabled}
        maxLength={maxLength}
        inputMode={inputMode}
        autoComplete={autoComplete}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
          if (e.key === "Escape") setLocal(committed.current);
        }}
        className={`focus-ring w-full rounded-lg border bg-[var(--bg-secondary)] px-3 py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-40 ${
          error ? "border-Aviel-red-500" : "border-[var(--border-subtle)]"
        }`}
      />
      {error && <span className="text-xs text-Aviel-red-500">{error}</span>}
    </div>
  );
}

export function SettingsButton({
  children,
  onClick,
  variant = "default",
  disabled,
  busy,
  title,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "default" | "primary" | "danger" | "ghost";
  disabled?: boolean;
  busy?: boolean;
  title?: string;
  type?: "button" | "submit";
}) {
  const styles =
    variant === "primary"
      ? "bg-accent-gradient text-white"
      : variant === "danger"
        ? "border border-Aviel-red-500/40 text-Aviel-red-500 hover:bg-Aviel-red-500/10"
        : variant === "ghost"
          ? "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
          : "border border-[var(--border-subtle)] hover:bg-[var(--surface-hover)]";

  return (
    <button
      type={type}
      onClick={onClick}
      title={title}
      disabled={disabled || busy}
      className={`focus-ring inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${styles}`}
    >
      {busy && <Loader2 size={13} className="animate-spin" />}
      {children}
    </button>
  );
}

/** A destructive action that asks once before doing it. */
export function ConfirmButton({
  children,
  confirmLabel = "Confirm",
  question,
  onConfirm,
  busy,
  disabled,
}: {
  children: React.ReactNode;
  confirmLabel?: string;
  question: string;
  onConfirm: () => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <SettingsButton variant="danger" onClick={() => setAsking(true)} disabled={disabled}>
        {children}
      </SettingsButton>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <p className="text-xs text-[var(--text-secondary)]">{question}</p>
      <div className="flex gap-2">
        <SettingsButton onClick={() => setAsking(false)}>Cancel</SettingsButton>
        <SettingsButton
          variant="danger"
          busy={busy}
          onClick={() => {
            setAsking(false);
            onConfirm();
          }}
        >
          {confirmLabel}
        </SettingsButton>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Status                                                                     */
/* -------------------------------------------------------------------------- */

/** Inline save feedback, so a control never changes silently. */
export function SaveIndicator({
  state,
  error,
  onRetry,
}: {
  state: SaveState;
  error?: string | null;
  onRetry?: () => void;
}) {
  if (state === "idle") return null;

  if (state === "error") {
    return (
      <span
        role="alert"
        className="flex items-center gap-2 text-xs text-Aviel-red-500"
      >
        <AlertCircle size={12} className="shrink-0" />
        {error ?? "Couldn't save this setting."}
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="focus-ring rounded px-1.5 py-0.5 underline underline-offset-2"
          >
            Retry
          </button>
        )}
      </span>
    );
  }

  const map = {
    saving: { icon: Loader2, text: "Saving…", cls: "text-[var(--text-secondary)]", spin: true },
    saved: { icon: Check, text: "Saved", cls: "text-accent", spin: false },
  } as const;

  const { icon: Icon, text, cls, spin } = map[state];

  return (
    <span className={`flex items-center gap-1.5 text-xs ${cls}`} role="status">
      <Icon size={12} className={spin ? "animate-spin" : ""} />
      {text}
    </span>
  );
}

export type PillTone = "ok" | "warn" | "off" | "neutral" | "accent";

export function StatusPill({
  tone = "neutral",
  children,
}: {
  tone?: PillTone;
  children: React.ReactNode;
}) {
  const styles: Record<PillTone, string> = {
    ok: "border-transparent bg-[var(--pill-ok-bg)] text-[var(--pill-ok-fg)]",
    warn: "border-transparent bg-[var(--pill-warn-bg)] text-[var(--pill-warn-fg)]",
    off: "border-transparent bg-Aviel-red-500/12 text-Aviel-red-500",
    accent: "border-transparent bg-accent-soft",
    neutral:
      "border-[var(--border-subtle)] text-[var(--text-secondary)]",
  };

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${styles[tone]}`}
    >
      {children}
    </span>
  );
}

/**
 * States why something on this screen cannot work.
 *
 * Used wherever a control is disabled because the infrastructure behind it does
 * not exist. Saying which piece is missing is the difference between "this
 * product is broken" and "this part isn't built yet".
 */
export function Callout({
  tone = "neutral",
  title,
  children,
}: {
  tone?: "neutral" | "warn" | "info";
  title?: string;
  children: React.ReactNode;
}) {
  const border =
    tone === "warn"
      ? "border-[var(--pill-warn-fg)]/30 bg-[var(--pill-warn-bg)]"
      : "border-[var(--border-subtle)] bg-[var(--bg-secondary)]";

  return (
    <div className={`mb-4 rounded-xl border px-4 py-3 ${border}`}>
      {title && <p className="text-xs font-semibold">{title}</p>}
      <div className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
        {children}
      </div>
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] px-3.5 py-3">
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-[var(--text-secondary)]">{label}</p>
      {hint && <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">{hint}</p>}
    </div>
  );
}

/** A row that navigates somewhere rather than changing a value. */
export function LinkRow({
  label,
  description,
  onClick,
  href,
  icon: Icon,
}: {
  label: string;
  description?: string;
  onClick?: () => void;
  href?: string;
  icon?: SectionIcon;
}) {
  const content = (
    <>
      <span className="flex min-w-0 items-center gap-2.5">
        {Icon && <Icon size={15} className="shrink-0 text-[var(--text-secondary)]" />}
        <span className="min-w-0">
          <span className="block text-sm font-medium">{label}</span>
          {description && (
            <span className="mt-0.5 block text-xs text-[var(--text-secondary)]">
              {description}
            </span>
          )}
        </span>
      </span>
      <ChevronRight size={15} className="shrink-0 text-[var(--text-secondary)]" />
    </>
  );

  const className =
    "focus-ring flex w-full items-center justify-between gap-3 border-b border-[var(--border-subtle)] py-3.5 text-left last:border-b-0 hover:text-[var(--text-primary)]";

  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer noopener" className={className}>
        {content}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}

export function LoadingRows({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="h-14 animate-pulse rounded-xl bg-black/5 dark:bg-white/5"
        />
      ))}
    </div>
  );
}
