import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/page-shell";

export const metadata: Metadata = {
  title: "Changelog — Aviel AI",
  description: "What has shipped in Aviel AI.",
};

/**
 * Only entries that correspond to work actually merged and deployed. This is a
 * changelog, not a roadmap — nothing appears here before it is live.
 */
const ENTRIES = [
  {
    version: "Web access and memory",
    items: [
      "Aviel can search the web and cites the pages it used. It searches on its own when an answer depends on current information.",
      "Memory now learns. With it switched on, Aviel notes durable things about you from your conversations instead of waiting for you to write a list. Every entry is visible and deletable.",
      "The microphone is always in the composer where the browser supports it, and listens in the language you choose.",
      "Light is now the default theme.",
    ],
  },
  {
    version: "Settings",
    items: [
      "A full settings panel: General, Notifications, Personalization, Plugins, Voice, Billing, Data controls, Storage, Security and login, Account, Keyboard.",
      "Custom instructions, added to every conversation.",
      "Sign out of individual devices. Sessions are listed with their last activity, and revoking one takes effect immediately.",
      "Export everything as JSON, delete all your data, or delete your account — each takes effect at once.",
      "Chat history can be turned off entirely; conversations are then deleted as each reply finishes.",
      "Accent colour and text size, applied across the whole interface.",
    ],
  },
  {
    version: "Foundations",
    items: [
      "Aviel went live: web app on Vercel, API and Postgres on Render.",
      "Pinned conversations, rename and delete from the sidebar, and a search that actually filters.",
      "Image attachments, collected into your Library.",
      "Projects, for grouping related conversations.",
    ],
  },
];

export default function ChangelogPage() {
  return (
    <MarketingPage
      title="Changelog"
      intro="What has shipped. Entries appear here after they are live, not before."
    >
      <div className="flex flex-col gap-8">
        {ENTRIES.map((entry) => (
          <section key={entry.version}>
            <h2 className="text-base font-semibold">{entry.version}</h2>
            <ul className="mt-3 flex flex-col gap-2">
              {entry.items.map((item) => (
                <li
                  key={item}
                  className="flex gap-2.5 text-[15px] leading-relaxed text-[var(--text-secondary)]"
                >
                  <span className="bg-accent mt-2 h-1.5 w-1.5 shrink-0 rounded-full" />
                  {item}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="mt-10 text-xs text-[var(--text-secondary)]">
        Aviel is open source — the full commit history is on{" "}
        <a
          href="https://github.com/Atelier-22/Aviel/commits/main"
          target="_blank"
          rel="noreferrer noopener"
          className="text-accent hover:underline"
        >
          GitHub
        </a>
        .
      </p>
    </MarketingPage>
  );
}
