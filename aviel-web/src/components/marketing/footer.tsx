import Link from "next/link";
import { AvielIcon } from "../logo";

/**
 * Footer.
 *
 * Only columns with real destinations. There is no blog, changelog, careers
 * page, help centre, status page or privacy policy yet, so those links are
 * absent rather than dead.
 */
const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/#what-it-does", label: "What it does" },
      { href: "/pricing", label: "Pricing" },
      { href: "/changelog", label: "Changelog" },
      { href: "/register", label: "Get started" },
      { href: "/login", label: "Log in" },
    ],
  },
  {
    title: "Resources",
    links: [
      { href: "/help", label: "Help" },
      { href: "/status", label: "Status" },
      {
        href: "https://github.com/Atelier-22/aviel",
        label: "Source on GitHub",
        external: true,
      },
      {
        href: "https://github.com/Atelier-22/aviel/issues",
        label: "Report a problem",
        external: true,
      },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/company", label: "Our story" },
      { href: "/careers", label: "Careers" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-[var(--border-subtle)] px-5 py-12">
      <div className="mx-auto max-w-5xl">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                {col.title}
              </h3>
              <ul className="mt-3 flex flex-col gap-2">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      {...("external" in l && l.external
                        ? { target: "_blank", rel: "noreferrer noopener" }
                        : {})}
                      className="text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-[var(--border-subtle)] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <AvielIcon size={22} />
            <span className="text-sm font-medium">Aviel AI</span>
          </div>
          <p className="text-xs text-[var(--text-secondary)]">
            Built in Uganda. Designed for the world. © {new Date().getFullYear()}{" "}
            Aviel AI.
          </p>
        </div>
      </div>
    </footer>
  );
}
