import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { env } from "../env";
import { db, schema } from "../db";

/**
 * Learning what matters about a user from their conversations.
 *
 * Runs after a reply has already been sent, so it never adds latency to the
 * turn the user is waiting on. It only runs when memory is switched on — this
 * is exactly the behaviour that setting is supposed to gate.
 */

const MAX_MEMORIES = 60;
const MAX_FACT_LENGTH = 200;

const EXTRACTION_PROMPT = `You maintain a long-term memory about a user of an AI assistant.

Read the exchange and decide whether it revealed anything durably true about the user that would make future conversations better.

Record only:
- Stable preferences ("prefers TypeScript", "wants short answers, no preamble")
- Ongoing context ("building a payments app", "learning Spanish")
- Facts about their situation ("based in Kampala", "works solo")

Never record:
- One-off questions or the subject of this conversation
- Anything already covered by an existing memory
- Sensitive personal data: health, finances, credentials, government identifiers, anything about named third parties
- Guesses. If it was not clearly stated or plainly implied, leave it out

Most exchanges reveal nothing worth keeping. Returning an empty list is the normal, correct outcome — do not invent something to record.

Reply with JSON only, in this exact shape:
{"facts": ["...", "..."]}

Each fact: one short sentence, written in the third person about the user.`;

function factsFrom(text: string): string[] {
  // The model is asked for bare JSON but may still fence it.
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return [];

  try {
    const parsed = JSON.parse(match[0]) as { facts?: unknown };
    if (!Array.isArray(parsed.facts)) return [];

    return parsed.facts
      .filter((f): f is string => typeof f === "string")
      .map((f) => f.trim())
      .filter((f) => f.length > 0 && f.length <= MAX_FACT_LENGTH)
      .slice(0, 3);
  } catch {
    return [];
  }
}

/** Cheap near-duplicate check — the model is told not to repeat itself, but it does. */
function isDuplicate(fact: string, existing: string[]): boolean {
  const normalise = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter(Boolean);

  const words = new Set(normalise(fact));
  if (words.size === 0) return true;

  return existing.some((e) => {
    const other = new Set(normalise(e));
    let shared = 0;
    for (const w of words) if (other.has(w)) shared++;
    // Two thirds of the words in common means it is saying the same thing.
    return shared / words.size >= 0.66;
  });
}

export async function learnFromExchange(params: {
  userId: string;
  userMessage: string;
  assistantMessage: string;
}): Promise<void> {
  if (!env.ANTHROPIC_API_KEY) return;

  const settings = await db.query.userSettings.findFirst({
    where: eq(schema.userSettings.userId, params.userId),
    columns: { memoryEnabled: true },
  });

  // Memory off means memory off — including the part that writes it.
  if (!settings?.memoryEnabled) return;

  const existing = await db.query.userMemory.findMany({
    where: eq(schema.userMemory.userId, params.userId),
    columns: { content: true },
    orderBy: (m, { desc }) => [desc(m.createdAt)],
    limit: MAX_MEMORIES,
  });

  if (existing.length >= MAX_MEMORIES) return;

  const known = existing.map((m) => m.content);

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  // A small, cheap model: this is extraction, not reasoning, and it runs after
  // every exchange.
  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 400,
    system: EXTRACTION_PROMPT,
    messages: [
      {
        role: "user",
        content: `Already known about this user:\n${
          known.length ? known.map((k) => `- ${k}`).join("\n") : "(nothing yet)"
        }\n\nThe exchange:\nUser: ${params.userMessage.slice(0, 3000)}\nAssistant: ${params.assistantMessage.slice(0, 3000)}`,
      },
    ],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const fresh = factsFrom(text).filter((f) => !isDuplicate(f, known));
  if (fresh.length === 0) return;

  await db.insert(schema.userMemory).values(
    fresh.map((content) => ({
      userId: params.userId,
      content,
      source: "inferred" as const,
    }))
  );
}

/**
 * Fire-and-forget wrapper.
 *
 * Learning must never break a conversation that already succeeded, so failures
 * are logged and swallowed rather than propagated to the request.
 */
export function learnInBackground(params: {
  userId: string;
  userMessage: string;
  assistantMessage: string;
}): void {
  learnFromExchange(params).catch((err) => {
    console.error(
      "Memory extraction failed:",
      err instanceof Error ? err.message : err
    );
  });
}
