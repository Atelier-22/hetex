import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "Hetex AI",
  description: "Hetex AI — Built in Uganda. Designed for the world.",
  // Declared here rather than via the src/app/favicon.ico file convention,
  // which takes precedence over this block — the two cannot both be used.
  //
  // favicon.ico and apple-touch-icon.png are served from the site ROOT, not
  // /brand. Browsers request /favicon.ico unconditionally and iOS requests
  // /apple-touch-icon.png, both ignoring these tags entirely; bookmarks,
  // history entries and link previews often use only those paths. Declaring
  // them at /brand alone left the root 404ing and the tab showing a globe.
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/brand/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/brand/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
