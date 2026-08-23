"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { HetexLockup } from "../logo";

/**
 * Marketing nav.
 *
 * Every link resolves to a real destination. "Docs" is deliberately absent —
 * no documentation exists yet, and pointing a Docs link at a source repository
 * is a bait-and-switch for anyone who isn't a developer.
 */
const LINKS = [
  { href: "/#what-it-does", label: "Product" },
  { href: "/pricing", label: "Pricing" },
  { href: "/company", label: "Company" },
];

export function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 bg-[var(--bg-primary)]/85 backdrop-blur transition-shadow ${
        scrolled
          ? "border-b border-[var(--border-subtle)] shadow-sm"
          : "border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
        <Link href="/" aria-label="Hetex AI — home">
          <HetexLockup height={26} priority />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="/login"
            className="rounded-full border border-[var(--border-subtle)] px-4 py-2 text-sm font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5"
          >
            Log in
          </Link>
          <Link
            href="/register"
            className="bg-accent-gradient rounded-full px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Get started
          </Link>
        </div>

        <button
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          className="rounded-lg p-2 text-[var(--text-secondary)] md:hidden"
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {menuOpen && (
        <div className="border-t border-[var(--border-subtle)] px-5 py-3 md:hidden">
          <nav className="flex flex-col gap-1">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="rounded-lg px-2 py-2.5 text-sm text-[var(--text-secondary)]"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 flex flex-col gap-2">
            <Link
              href="/login"
              onClick={() => setMenuOpen(false)}
              className="rounded-full border border-[var(--border-subtle)] px-4 py-2.5 text-center text-sm font-medium"
            >
              Log in
            </Link>
            <Link
              href="/register"
              onClick={() => setMenuOpen(false)}
              className="bg-accent-gradient rounded-full px-4 py-2.5 text-center text-sm font-semibold text-white"
            >
              Get started
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
