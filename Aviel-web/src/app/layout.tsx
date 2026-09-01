import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

// The wordmark face, and nothing else. Scoped to a CSS variable rather than
// applied to body so it cannot leak into interface copy, which stays on the
// system sans stack for legibility at small sizes.
const serif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600"],
  display: "swap",
  variable: "--font-serif",
  // A real fallback, so the wordmark still reads as a wordmark if the font
  // never arrives.
  fallback: ["Georgia", "Times New Roman", "serif"],
});

export const metadata: Metadata = {
  title: "Aviel",
  description: "Aviel — Think · Decide · Grow. Built in Uganda. Designed for the world.",
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Deliberately not capping maximum-scale or setting user-scalable: false.
  // Blocking pinch-zoom is a real accessibility failure, and it is the usual
  // reason a mobile app is unusable for anyone who needs to magnify text.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7faf9" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0f0d" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={serif.variable} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
