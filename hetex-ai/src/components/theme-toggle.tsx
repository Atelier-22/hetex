"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { apiFetch } from "@/lib/api-client";

const options = [
  { value: "system", icon: Monitor, label: "System" },
  { value: "light", icon: Sun, label: "Light" },
  { value: "dark", icon: Moon, label: "Dark" },
] as const;

type ThemeValue = (typeof options)[number]["value"];

// This component renders in both the sidebar and the settings page. Without a
// module-level guard each instance would pull settings separately, and the two
// could race each other into opposite values.
let syncedThisPageLoad = false;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // The account's stored preference is the source of truth, so choosing dark on
  // a laptop carries over to a phone. next-themes has already painted from
  // localStorage by now, which is what keeps this from flashing on every load.
  useEffect(() => {
    if (!mounted || syncedThisPageLoad) return;
    syncedThisPageLoad = true;

    apiFetch<{ theme?: string }>("/settings")
      .then((s) => {
        if (s.theme && s.theme !== theme) setTheme(s.theme);
      })
      .catch(() => {
        // Signed out, or the API is unreachable — the local preference stands.
      });
  }, [mounted, theme, setTheme]);

  function choose(value: ThemeValue) {
    setTheme(value);
    apiFetch("/settings", {
      method: "PATCH",
      body: JSON.stringify({ theme: value }),
    }).catch(() => {
      // Best effort. The theme still applies locally; it just won't follow the
      // account to another device until a later save succeeds.
    });
  }

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
          onClick={() => choose(value)}
          aria-label={label}
          aria-pressed={theme === value}
          title={label}
          className={`rounded-full p-1.5 transition-colors ${
            theme === value
              ? "bg-hetex-green-500 text-white"
              : "text-[var(--text-secondary)] hover:bg-hetex-green-50 dark:hover:bg-white/5"
          }`}
        >
          <Icon size={14} />
        </button>
      ))}
    </div>
  );
}
