import { MarketingNav } from "./nav";
import { MarketingFooter } from "./footer";

/**
 * Shared frame for the public pages, so nav, spacing and footer stay identical
 * across them.
 */
export function MarketingPage({
  title,
  intro,
  children,
  wide,
}: {
  title: string;
  intro?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <MarketingNav />
      <main
        className={`mx-auto px-5 py-14 sm:py-16 ${wide ? "max-w-4xl" : "max-w-2xl"}`}
      >
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {title}
        </h1>
        {intro && (
          <p className="mt-3 text-[15px] leading-relaxed text-[var(--text-secondary)]">
            {intro}
          </p>
        )}
        <div className="mt-10">{children}</div>
      </main>
      <MarketingFooter />
    </div>
  );
}

export function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4 text-[15px] leading-relaxed text-[var(--text-secondary)]">
      {children}
    </div>
  );
}

export function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 mt-10 text-lg font-semibold text-[var(--text-primary)] first:mt-0">
      {children}
    </h2>
  );
}
