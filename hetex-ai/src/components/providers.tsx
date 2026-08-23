"use client";

import { ThemeProvider } from "next-themes";
import { SessionProvider } from "next-auth/react";
import { PreferencesProvider } from "./preferences";
import { SettingsProvider } from "./settings/settings-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <PreferencesProvider>
          <SettingsProvider>{children}</SettingsProvider>
        </PreferencesProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
