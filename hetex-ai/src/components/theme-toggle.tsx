"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { usePreferences } from "./preferences";

const options = [
  { value: "system", icon: Monitor, label: "System" },
  { value: "light", icon: Sun, label: "Light" },
  { value: "dark", icon: Moon, label: "Dark" },
] as const;

export function ThemeToggle() {
  const { theme } = useTheme();
  const { update } = usePreferences();
  const [mounted, setMounted] = useState(false);

  // next-themes resolves the active theme on the client, so rendering the
  // selected state during SSR would produce a hydration mismatch.
  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="h-8 w-24" />;

  return (
    <div
      className="flex items-center gap-1 rounded-full border border-[var(--border-subtle)] p-1"
      role="group"
      aria-label="Theme"
    >
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          // Saving through preferences applies it locally and persists it to
          // the account in one step, so the choice follows you to other devices.
          onClick={() => update({ theme: value })}
          aria-label={label}
          aria-pressed={theme === value}
          title={label}
          className={`rounded-full p-1.5 transition-colors ${
            theme === value
              ? "bg-accent text-white"
              : "text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/5"
          }`}
        >
          <Icon size={14} />
        </button>
      ))}
    </div>
  );
}
