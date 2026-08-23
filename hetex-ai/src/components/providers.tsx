"use client";

import { ThemeProvider } from "next-themes";
import { SessionProvider } from "next-auth/react";
import { PreferencesProvider } from "./preferences";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <PreferencesProvider>{children}</PreferencesProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
