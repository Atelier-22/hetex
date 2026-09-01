import type { Metadata } from "next";
import Link from "next/link";
import { MarketingPage, Prose, H2 } from "@/components/marketing/page-shell";

export const metadata: Metadata = {
  title: "Careers — Aviel AI",
  description: "Aviel AI is a two-person team and is not hiring yet.",
};

/**
 * No open roles, so none are listed. A careers page with invented positions
 * wastes the time of the people most worth talking to.
 */
export default function CareersPage() {
  return (
    <MarketingPage
      title="Careers"
      intro="Short version: we are not hiring yet."
    >
      <Prose>
        <p>
          Aviel AI is two people — Muhwezi Peter, who builds it, and Alafi
          Jonathan, who works on design and product direction. There is no
          funding, no headcount plan, and no open roles.
        </p>

        <H2>When that changes</H2>
        <p>
          It will be posted here first, with the actual role and what it pays.
          Until then there is nothing to apply for, and we would rather say so
          than collect applications against positions that do not exist.
        </p>

        <H2>If you want to be involved anyway</H2>
        <p>
          Aviel is open source. The most direct way in is to use it, find
          something wrong, and{" "}
          <a
            href="https://github.com/Atelier-22/aviel/issues"
            target="_blank"
            rel="noreferrer noopener"
            className="text-accent hover:underline"
          >
            say so
          </a>
          . Good bug reports and pull requests are read, and they tell us more
          than a CV would.
        </p>

        <p className="text-[var(--text-primary)]">
          Built in Uganda. Designed for the world.{" "}
          <Link href="/company" className="text-accent hover:underline">
            More about why
          </Link>
          .
        </p>
      </Prose>
    </MarketingPage>
  );
}
