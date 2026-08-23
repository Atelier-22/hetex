import type { Metadata } from "next";
import Link from "next/link";
import { MarketingPage } from "@/components/marketing/page-shell";

export const metadata: Metadata = {
  title: "Help — Hetex AI",
  description: "How Hetex AI works, and answers to common questions.",
};

/** Every answer describes behaviour that exists in the product today. */
const FAQ = [
  {
    q: "Can Hetex search the web?",
    a: "Yes. It searches automatically when an answer depends on current information — news, prices, anything that changes — and cites the pages it used. You can also press the globe in the composer menu to insist it looks something up.",
  },
  {
    q: "Does it remember me between conversations?",
    a: "Only if you turn Memory on, in Settings → Personalization. It is off by default. With it on, Hetex notes durable things about you — how you like answers, what you are working on — and you can read and delete every entry. Turning it off stops it both reading and adding.",
  },
  {
    q: "Can I stop it saving my conversations?",
    a: "Yes. Settings → Data controls → Save chat history. With it off, each conversation is deleted as soon as the reply finishes. Existing conversations are left alone.",
  },
  {
    q: "Can I talk instead of typing?",
    a: "Yes, if your browser supports speech recognition — Chrome and Edge do, Firefox and Safari do not. The microphone is in the composer. You can change the language it listens for in Settings → Voice.",
  },
  {
    q: "Can it read images and files?",
    a: "Images, yes — attach one and ask about it. PDFs and text files are stored and named but their contents are not read yet.",
  },
  {
    q: "How do I get a better answer on something hard?",
    a: "Settings → General → Higher intelligence switches to a stronger model. It is noticeably better at difficult reasoning and several times more expensive per message.",
  },
  {
    q: "Can I make it always answer a certain way?",
    a: "Settings → Personalization → Custom instructions. Whatever you write there is added to every conversation — for example, that you want code with no preamble, or answers in a particular language.",
  },
  {
    q: "How do I sign out of a device I no longer have?",
    a: "Settings → Security and login lists every device signed in, with its last activity. Signing one out takes effect immediately, not when its session eventually expires.",
  },
  {
    q: "Is there a mobile app?",
    a: "There is a React Native app that talks to the same backend, so an account and its conversations work across both. The web app also works on a phone browser.",
  },
  {
    q: "What does it cost?",
    a: "Nothing. Hetex is free while in early access, and there are no paid plans yet.",
  },
  {
    q: "How do I delete everything?",
    a: "Settings → Data controls. You can export everything first as a JSON file, delete all your data while keeping the account, or delete the account entirely. All three take effect immediately.",
  },
];

export default function HelpPage() {
  return (
    <MarketingPage
      title="Help"
      intro="How Hetex AI works today. If something here does not match what you see, that is a bug — please tell us."
    >
      <div className="flex flex-col gap-3">
        {FAQ.map(({ q, a }) => (
          <details
            key={q}
            className="group rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-3.5"
          >
            <summary className="cursor-pointer list-none text-[15px] font-medium marker:content-none">
              <span className="flex items-center justify-between gap-4">
                {q}
                <span className="shrink-0 text-[var(--text-secondary)] transition-transform group-open:rotate-45">
                  +
                </span>
              </span>
            </summary>
            <p className="mt-2.5 text-sm leading-relaxed text-[var(--text-secondary)]">
              {a}
            </p>
          </details>
        ))}
      </div>

      <div className="mt-10 rounded-xl border border-[var(--border-subtle)] px-4 py-4">
        <p className="text-sm font-medium">Still stuck?</p>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          There is no support desk yet — Hetex is a small team. The most
          reliable route is to{" "}
          <a
            href="https://github.com/Atelier-22/hetex/issues"
            target="_blank"
            rel="noreferrer noopener"
            className="text-accent hover:underline"
          >
            open an issue on GitHub
          </a>
          , which we read. You can also check{" "}
          <Link href="/status" className="text-accent hover:underline">
            service status
          </Link>{" "}
          if something looks broken.
        </p>
      </div>
    </MarketingPage>
  );
}
