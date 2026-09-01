import { eq } from "drizzle-orm";
import { env } from "../env";
import { db, schema } from "../db";
import { generateAI } from "../ai/router";
import { loadSettings } from "../settings/store";
import { getPlatformConfig } from "../settings/platform";
import { MEMORY_CATEGORIES, type MemoryCategory } from "../settings/schema";
import { enabledMemoryCategories } from "./chat.service";

/**
 * Learning what matters about a user from their conversations.
 *
 * Runs after a reply has already been sent, so it never adds latency to the
 * turn the user is waiting on. It only runs when memory is switched on — this
 * is exactly the behaviour that setting is supposed to gate.
 */

const MAX_FACT_LENGTH = 200;

const CATEGORY_GUIDE = `Each fact must be filed under exactly one category:
- "preferences"      — how they want you to work ("prefers TypeScript", "wants short answers")
- "projects"         — what they are building or working on ("building a payments app")
- "personalization"  — durable facts about them ("based in Kampala", "works solo")
- "conversation"     — context that spans conversations but is not any of the above`;

const EXTRACTION_PROMPT = `You maintain a long-term memory about a user of an AI assistant.

Read the exchange and decide whether it revealed anything durably true about the user that would make future conversations better.

${CATEGORY_GUIDE}

Never record:
- One-off questions or the subject of this conversation
- Anything already covered by an existing memory
- Sensitive personal data: health, finances, credentials, government identifiers, anything about named third parties
- Guesses. If it was not clearly stated or plainly implied, leave it out

Most exchanges reveal nothing worth keeping. Returning an empty list is the normal, correct outcome — do not invent something to record.

Reply with JSON only, in this exact shape:
{"facts": [{"text": "...", "category": "preferences"}]}

Each fact: one short sentence, written in the third person about the user.`;

export type ExtractedFact = { text: string; category: MemoryCategory };

export function factsFrom(text: string): ExtractedFact[] {
  // The model is asked for bare JSON but may still fence it.
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return [];

  try {
    const parsed = JSON.parse(match[0]) as { facts?: unknown };
    if (!Array.isArray(parsed.facts)) return [];

    return parsed.facts
      .map((f): ExtractedFact | null => {
        // Older prompts produced bare strings; accept both rather than losing
        // an otherwise valid extraction to a shape change.
        if (typeof f === "string") {
          return { text: f.trim(), category: "preferences" };
        }
        if (!f || typeof f !== "object") return null;
        const raw = f as { text?: unknown; category?: unknown };
        if (typeof raw.text !== "string") return null;
        const category = MEMORY_CATEGORIES.includes(raw.category as MemoryCategory)
          ? (raw.category as MemoryCategory)
          : "preferences";
        return { text: raw.text.trim(), category };
      })
      .filter(
        (f): f is ExtractedFact =>
          f !== null && f.text.length > 0 && f.text.length <= MAX_FACT_LENGTH
      )
      .slice(0, 3);
  } catch {
    return [];
  }
}

/** Cheap near-duplicate check — the model is told not to repeat itself, but it does. */
export function isDuplicate(fact: string, existing: string[]): boolean {
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

  const [settings, config] = await Promise.all([
    loadSettings(params.userId),
    getPlatformConfig(),
  ]);

  // Memory off means memory off — including the part that writes it. So does
  // "don't add to memory on its own", which is what autoCapture gates: manual
  // entries still work, but nothing is inferred.
  if (!settings.memory.enabled || !settings.memory.autoCapture) return;

  // A category the user has switched off is never written, so it can never be
  // recalled later either.
  const allowed = enabledMemoryCategories(settings) as MemoryCategory[];
  if (allowed.length === 0) return;

  const cap = config.limits.maxMemoryEntries;

  const existing = await db.query.userMemory.findMany({
    where: eq(schema.userMemory.userId, params.userId),
    columns: { content: true },
    orderBy: (m, { desc }) => [desc(m.createdAt)],
    limit: cap,
  });

  if (existing.length >= cap) return;

  const known = existing.map((m) => m.content);

  // A small, cheap model: this is extraction, not reasoning, and it runs after
  // every exchange. The router drops to the local model if the API is down —
  // this needs no tool calling, and a malformed reply is already handled by
  // factsFrom returning nothing.
  const { text } = await generateAI(
    `Already known about this user:\n${
      known.length ? known.map((k) => `- ${k}`).join("\n") : "(nothing yet)"
    }\n\nThe exchange:\nUser: ${params.userMessage.slice(0, 3000)}\nAssistant: ${params.assistantMessage.slice(0, 3000)}`,
    EXTRACTION_PROMPT,
    { vendorModel: "claude-haiku-4-5", maxTokens: 400 }
  );

  const fresh = factsFrom(text)
    .filter((f) => allowed.includes(f.category))
    .filter((f) => !isDuplicate(f.text, known))
    .slice(0, Math.max(0, cap - existing.length));

  if (fresh.length === 0) return;

  await db.insert(schema.userMemory).values(
    fresh.map((f) => ({
      userId: params.userId,
      content: f.text,
      category: f.category,
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
