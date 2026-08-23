"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";

const options = [
  { value: "system", icon: Monitor, label: "System" },
  { value: "light", icon: Sun, label: "Light" },
  { value: "dark", icon: Moon, label: "Dark" },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-8 w-24" />;

  return (
    <div className="flex items-center gap-1 rounded-full border border-[var(--border-subtle)] p-1">
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          aria-label={label}
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
