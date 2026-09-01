"use client";

import { ThemeProvider } from "next-themes";
import { SessionProvider } from "next-auth/react";
import { SettingsProvider } from "@/lib/settings/store";
import { SettingsUiProvider } from "./settings/settings-context";
import { IdleTimeout } from "./idle-timeout";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {/* next-themes owns the light/dark class. The account owns which one, so
          the choice follows you between devices — see the settings store. */}
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <SettingsProvider>
          <SettingsUiProvider>
            <IdleTimeout />
            {children}
          </SettingsUiProvider>
        </SettingsProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
