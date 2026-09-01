"use client";

import { useEffect, useState } from "react";
import { Sun, Moon, Monitor, Zap } from "lucide-react";
import { useSettingsStore } from "@/lib/settings/store";
import type { Theme } from "@/lib/settings/types";

const options = [
  { value: "system", icon: Monitor, label: "System" },
  { value: "light", icon: Sun, label: "Light" },
  { value: "dark", icon: Moon, label: "Dark" },
  { value: "amoled", icon: Zap, label: "AMOLED" },
] as const satisfies readonly { value: Theme; icon: unknown; label: string }[];

export function ThemeToggle() {
  const { settings, update } = useSettingsStore();
  const [mounted, setMounted] = useState(false);

  // The theme is resolved on the client, so rendering the selected state during
  // SSR would produce a hydration mismatch.
  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="h-8 w-32" />;

  const active = settings.appearance.theme;

  return (
    <div
      className="flex items-center gap-1 rounded-full border border-[var(--border-subtle)] p-1"
      role="group"
      aria-label="Theme"
    >
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          // Saving through the store applies it locally and persists it to the
          // account in one step, so the choice follows you to other devices.
          onClick={() => void update({ appearance: { theme: value } })}
          aria-label={label}
          aria-pressed={active === value}
          title={label}
          className={`focus-ring rounded-full p-1.5 transition-colors ${
            active === value
              ? "bg-accent text-white"
              : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
          }`}
        >
          <Icon size={14} />
        </button>
      ))}
    </div>
  );
}
