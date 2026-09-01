// Aviel — sessions.
//
// A session is a focused stretch of work: a type, a clock, accumulated context
// and an optional summary at the end. It wraps a conversation rather than
// replacing it, so messages stay where they were and a session is framing on
// top of data that already works.
//
// The type is not a label. Each one contributes a real block to the system
// prompt describing what to prioritise, which is the whole point of choosing
// one.

import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "../db";
import { generateAI } from "../ai/router";

export const SESSION_TYPES = [
  "chat",
  "voice",
  "study",
  "brainstorm",
  "coding",
  "research",
  "creative",
  "meeting",
] as const;

export type SessionType = (typeof SESSION_TYPES)[number];

export const SESSION_TYPE_META: Record<
  SessionType,
  { label: string; description: string }
> = {
  chat: { label: "Chat", description: "An ordinary conversation, with a clock and a summary." },
  voice: { label: "Voice", description: "Hands-free back-and-forth, spoken." },
  study: { label: "Study", description: "Learning something. Explanations, checks for understanding." },
  brainstorm: { label: "Brainstorm", description: "Generating options rather than settling on one." },
  coding: { label: "Coding", description: "Code, errors and technical decisions." },
  research: { label: "Research", description: "Evidence, sources and structured findings." },
  creative: { label: "Creative", description: "Writing and making, with room to be surprising." },
  meeting: { label: "Discussion", description: "Working a decision through with someone else in the room." },
};

/**
 * What each session type asks of the model.
 *
 * Written as instructions rather than adjectives: "ask what they already know"
 * changes a reply, "be educational" does not.
 */
const TYPE_INSTRUCTIONS: Record<SessionType, string> = {
  chat: "",

  voice: `This is a spoken session. The user is hearing your replies, not reading them.
- Keep answers short enough to listen to. Two or three sentences unless asked for more.
- No markdown, no code blocks, no bullet lists — none of it survives being read aloud.
- Spell out anything that would be ambiguous heard rather than seen.
- If something genuinely needs a long answer or code, say so and offer to put it in the chat instead.`,

  study: `This is a study session. The user is trying to understand something, not just get an answer.
- Find out what they already know before explaining, and pitch it there.
- Build up from what they have, one idea at a time.
- Use concrete examples and analogies, then say where the analogy breaks.
- Check understanding by asking them to apply it, not by asking "does that make sense".
- Giving them the answer to a problem they are working through defeats the point — offer a hint first.`,

  brainstorm: `This is a brainstorming session. Quantity and range beat polish.
- Offer several genuinely different options, not one idea and two variations of it.
- Include at least one that is unobvious, even if it is unlikely to be chosen.
- Do not evaluate or rank while ideas are still coming, unless asked.
- Build on what the user says rather than replacing it.
- Say when an idea has a known problem, but say it briefly and keep going.`,

  coding: `This is a coding session. The user is building something.
- Give complete, runnable code rather than fragments with "..." in the middle.
- Say which file and where, when it matters.
- Name the trade-off when you choose an approach, especially where a common alternative exists.
- Read errors carefully and address the actual cause, not the symptom.
- Point out a bug you notice in passing even if it was not what was asked about.`,

  research: `This is a research session. Conclusions have to be traceable.
- Separate what is established, what is contested and what you are inferring.
- Cite sources where you have them, and say plainly when you do not.
- Give the shape of the evidence — how strong, how recent, who disputes it.
- Structure findings so they can be scanned: what was asked, what was found, what remains open.
- Where the honest answer is "the evidence does not settle this", say that rather than picking a side.`,

  creative: `This is a creative session. The work matters more than the explanation of it.
- Produce the thing rather than describing what you would produce.
- Take a real stylistic position instead of hedging toward the average.
- Offer an alternative direction when one is genuinely different, not as a safety net.
- Keep critique for when it is asked for.`,

  meeting: `This is a discussion session. The user is working a decision through, possibly with other people present.
- Track the positions on the table and whose they are.
- Surface disagreement rather than smoothing it over.
- Note decisions as they are made, and what is still open.
- Ask the question that has not been asked when you notice one.
- Keep contributions short — you are one voice in a room, not the chair.`,
};

/** The session block for the system prompt, empty for a plain chat session. */
export function sessionPromptBlock(session: {
  type: string;
  title: string;
  contextNotes: string[];
}): string {
  const type = (SESSION_TYPES as readonly string[]).includes(session.type)
    ? (session.type as SessionType)
    : "chat";

  const instructions = TYPE_INSTRUCTIONS[type];
  const parts: string[] = [];

  if (instructions) parts.push(instructions);

  // The accumulated context is what makes "how should I handle the payments"
  // resolve against something said twenty turns ago.
  if (session.contextNotes.length > 0) {
    parts.push(
      `What this session has established so far:\n${session.contextNotes
        .map((n) => `- ${n}`)
        .join("\n")}\nTreat these as current. When the user refers to "it", "the app" or "the project", this is what they mean.`
    );
  }

  if (parts.length === 0) return "";

  return `\n\nYou are in a session titled "${session.title}".\n\n${parts.join("\n\n")}`;
}

/* -------------------------------------------------------------------------- */
/* Context accumulation                                                       */
/* -------------------------------------------------------------------------- */

const MAX_CONTEXT_NOTES = 12;

/**
 * Pull durable facts out of a turn and keep them on the session.
 *
 * Deliberately narrower than long-term memory: this is scoped to the session,
 * discarded with it, and about the work rather than the person. It runs after
 * the reply has been delivered, so it never adds latency to the turn.
 */
const CONTEXT_PROMPT = `You are tracking what a working session has established.

From this exchange, extract only facts that later messages would need in order to make sense — the subject being worked on, decisions made, constraints stated, names given to things.

Do not record:
- Questions, or anything still undecided
- Anything already in the known list
- Pleasantries, or the mechanics of the conversation
- Anything about the person rather than the work

Most exchanges establish nothing new. An empty list is the normal, correct answer.

Reply with JSON only: {"facts": ["..."]}
Each fact: one short sentence, present tense.`;

export function contextFactsFrom(text: string): string[] {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]) as { facts?: unknown };
    if (!Array.isArray(parsed.facts)) return [];
    return parsed.facts
      .filter((f): f is string => typeof f === "string")
      .map((f) => f.trim())
      .filter((f) => f.length > 0 && f.length <= 200)
      .slice(0, 3);
  } catch {
    return [];
  }
}

export async function updateSessionContext(params: {
  sessionId: string;
  userMessage: string;
  assistantMessage: string;
}): Promise<void> {
  const session = await db.query.sessions.findFirst({
    where: eq(schema.sessions.id, params.sessionId),
    columns: { contextNotes: true, state: true },
  });

  if (!session || session.state !== "active") return;
  if (session.contextNotes.length >= MAX_CONTEXT_NOTES) return;

  const known = session.contextNotes;

  const { text } = await generateAI(
    `Already established:\n${
      known.length ? known.map((k) => `- ${k}`).join("\n") : "(nothing yet)"
    }\n\nThe exchange:\nUser: ${params.userMessage.slice(0, 3000)}\nAssistant: ${params.assistantMessage.slice(0, 3000)}`,
    CONTEXT_PROMPT,
    { vendorModel: "claude-haiku-4-5", maxTokens: 400 }
  );

  const fresh = contextFactsFrom(text).filter(
    (f) => !known.some((k) => k.toLowerCase() === f.toLowerCase())
  );
  if (fresh.length === 0) return;

  await db
    .update(schema.sessions)
    .set({
      contextNotes: [...known, ...fresh].slice(0, MAX_CONTEXT_NOTES),
      updatedAt: new Date(),
    })
    .where(eq(schema.sessions.id, params.sessionId));
}

/** Fire-and-forget: context tracking must never break a working conversation. */
export function trackContextInBackground(params: {
  sessionId: string;
  userMessage: string;
  assistantMessage: string;
}): void {
  updateSessionContext(params).catch((err) =>
    console.error(
      "Session context tracking failed:",
      err instanceof Error ? err.message : err
    )
  );
}

/* -------------------------------------------------------------------------- */
/* Summary                                                                    */
/* -------------------------------------------------------------------------- */

const SUMMARY_PROMPT = `Summarise a working session for the person who was in it.

Use only what is in the transcript. Do not invent decisions, tasks or conclusions that were not reached — an empty section is correct and useful, a fabricated one is not.

Format exactly as markdown with these headings, omitting any section that would be empty:

## Topic
One or two sentences.

## Key decisions
What was settled, as bullets.

## Open questions
What was raised and not resolved.

## Tasks
Anything the user said they would do, or agreed to do.

## Ideas
Options generated and worth keeping, if this was that kind of session.

Be brief. This is a record, not a retelling.`;

/**
 * Generate and store a summary of a session.
 *
 * Returns null when there is nothing to summarise — a session with two messages
 * does not need a report, and producing one would be padding.
 */
export async function generateSessionSummary(
  sessionId: string,
  userId: string
): Promise<string | null> {
  const session = await db.query.sessions.findFirst({
    where: and(eq(schema.sessions.id, sessionId), eq(schema.sessions.userId, userId)),
  });

  if (!session?.conversationId) return null;

  const messages = await db.query.messages.findMany({
    where: eq(schema.messages.conversationId, session.conversationId),
    orderBy: [schema.messages.createdAt],
  });

  // Four messages is two exchanges. Less than that has no shape to summarise.
  if (messages.length < 4) return null;

  const transcript = messages
    .map((m) => `${m.role === "user" ? "User" : "Aviel"}: ${m.content}`)
    .join("\n\n")
    .slice(0, 24000);

  const { text } = await generateAI(
    `Session type: ${session.type}\nTitle: ${session.title}\n\nTranscript:\n\n${transcript}`,
    SUMMARY_PROMPT,
    { maxTokens: 1200 }
  );

  const summary = text.trim();
  if (!summary) return null;

  await db
    .update(schema.sessions)
    .set({ summary, summaryGeneratedAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.sessions.id, sessionId));

  return summary;
}

/* -------------------------------------------------------------------------- */
/* Lookup                                                                     */
/* -------------------------------------------------------------------------- */

/** The active session for a conversation, if it is part of one. */
export async function sessionForConversation(conversationId: string) {
  return db.query.sessions.findFirst({
    where: and(
      eq(schema.sessions.conversationId, conversationId),
      eq(schema.sessions.state, "active")
    ),
  });
}

export async function listSessions(userId: string, limit = 50) {
  return db.query.sessions.findMany({
    where: eq(schema.sessions.userId, userId),
    orderBy: [desc(schema.sessions.startedAt)],
    limit,
  });
}

/** Seconds elapsed, live for an active session and fixed once it has ended. */
export function sessionDuration(session: {
  startedAt: Date;
  endedAt: Date | null;
}): number {
  const end = session.endedAt ?? new Date();
  return Math.max(0, Math.round((end.getTime() - session.startedAt.getTime()) / 1000));
}
