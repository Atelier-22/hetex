import type { Metadata } from "next";
import Link from "next/link";
import { MarketingPage, Prose, H2 } from "@/components/marketing/page-shell";

export const metadata: Metadata = {
  title: "Privacy — Hetex AI",
  description: "What Hetex AI stores, why, and how to remove it.",
};

/**
 * Describes what the software actually does — the tables it writes, the
 * settings that change that behaviour, and the endpoints that delete it. Every
 * claim here is checkable against the code.
 */
export default function PrivacyPage() {
  return (
    <MarketingPage
      title="Privacy"
      intro="Written to describe what the product actually does, not to cover us. If anything here stops being true, it gets changed."
    >
      <Prose>
        <H2>What we store</H2>
        <ul className="ml-5 list-disc space-y-1.5">
          <li>
            <strong className="text-[var(--text-primary)]">Your account</strong>{" "}
            — email, display name, and a bcrypt hash of your password. We never
            store the password itself and cannot recover it.
          </li>
          <li>
            <strong className="text-[var(--text-primary)]">
              Your conversations
            </strong>{" "}
            — messages you send and replies you receive, so you can come back to
            them. You can turn this off entirely in Settings → Data controls,
            and conversations are then deleted the moment each reply finishes.
          </li>
          <li>
            <strong className="text-[var(--text-primary)]">Attachments</strong> —
            images you attach are stored so your Library can show them.
          </li>
          <li>
            <strong className="text-[var(--text-primary)]">Memory</strong> — only
            if you switch it on. It is off by default. Turning it off stops both
            reading and writing.
          </li>
          <li>
            <strong className="text-[var(--text-primary)]">Sessions</strong> —
            the device, browser and IP address of each sign-in, so you can see
            where you are logged in and sign a device out.
          </li>
          <li>
            <strong className="text-[var(--text-primary)]">Usage counts</strong>{" "}
            — how many messages you have sent.
          </li>
        </ul>

        <H2>What we do not do</H2>
        <ul className="ml-5 list-disc space-y-1.5">
          <li>
            <strong className="text-[var(--text-primary)]">
              We do not train on your conversations.
            </strong>{" "}
            Hetex does not train models at all.
          </li>
          <li>We do not sell your data or share it with advertisers.</li>
          <li>
            We do not run analytics or advertising trackers on the product.
          </li>
        </ul>

        <H2>Who else sees your messages</H2>
        <p>
          To answer you, your message and the recent conversation are sent to
          the AI provider that generates the reply, and returned to you. If a
          question needs current information, a search query derived from it is
          sent to a search service and the resulting pages are read.
        </p>
        <p>
          Hetex runs on Render (application and database) and Vercel (the
          website). Both process data on our behalf as infrastructure providers.
        </p>

        <H2>Taking your data back, or removing it</H2>
        <p>All of this is in Settings → Data controls, and works immediately:</p>
        <ul className="ml-5 list-disc space-y-1.5">
          <li>
            <strong className="text-[var(--text-primary)]">Export</strong> —
            downloads everything as one JSON file, straight away. No waiting for
            an email.
          </li>
          <li>
            <strong className="text-[var(--text-primary)]">
              Delete all my data
            </strong>{" "}
            — removes every conversation, project, file and memory entry, and
            keeps the account.
          </li>
          <li>
            <strong className="text-[var(--text-primary)]">
              Delete my account
            </strong>{" "}
            — removes the account and everything attached to it. This is
            immediate and permanent; there is no recovery window.
          </li>
        </ul>

        <H2>Security</H2>
        <p>
          Passwords are hashed with bcrypt. Traffic is encrypted in transit.
          Signing out of a device revokes that session immediately rather than
          waiting for a token to expire.
        </p>
        <p>
          Hetex is an early-stage product built by a small team. It has not had
          an external security audit. If you find a problem, please report it
          rather than publish it.
        </p>

        <H2>Children</H2>
        <p>
          Hetex AI is not intended for children under 13, and accounts should
          not be created for them.
        </p>

        <H2>Changes and contact</H2>
        <p>
          If this policy changes materially we will say so on this page rather
          than update it quietly. For anything privacy-related, or to ask what
          is held about you, contact us through the details in the{" "}
          <Link href="/terms" className="text-accent hover:underline">
            Terms
          </Link>
          .
        </p>
      </Prose>
    </MarketingPage>
  );
}
