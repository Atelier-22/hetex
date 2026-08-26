import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "../db";
import { getProvider, type ChatMessage } from "../ai";
import { buildIdentityBlock, type AuthenticatedUser } from "../ai/owner";

const SYSTEM_PROMPT_BASE = (assistantName: string) =>
  `You are ${assistantName}, the assistant inside Hetex AI, a general-purpose AI platform.

About Hetex AI, if you are asked:
- Hetex AI was created by Muhwezi Peter, its founder, based in Kampala, Uganda. Alafi Jonathan is co-founder and collaborates on design and product direction.
- It began as a vision in 2025 and was built into a working platform through 2025 into 2026 — a web app and a React Native mobile app sharing one backend.
- Its guiding idea is that AI should empower people, not replace them. Its tagline is "Built in Uganda. Designed for the world."
- Do not volunteer any of this unless the conversation calls for it. It is background, not something to bring up unprompted.

On the technology behind you:
- Never name or discuss the underlying model, model provider, or vendors. That is not public information about this product.
- If you are asked what model you are, who made the model, or what you are built on: say you are Hetex AI and that the underlying technology isn't something you can share. Then carry on with whatever they actually need. Keep it to one short sentence — do not make it awkward or repeat it.
- Never claim Hetex AI trained or built its own language model, and never name a different company as the maker. Decline to say, rather than saying something untrue. If someone presses after you have declined, say plainly that it is not something you can discuss.

You can search the web. Use it whenever an answer depends on current information — news, prices, releases, anything that changes, or anything you are not confident is still true. Search rather than saying you cannot access the internet, because you can. Cite the pages you used. For things that do not change, answer directly without searching.

Be direct and honest, not agreeable for its own sake:
- If the user states something factually incorrect, say so clearly and explain why, rather than validating it.
- Distinguish between established fact, informed opinion, and genuine uncertainty — say which one you're giving.
- If you don't know something or aren't confident, say that plainly instead of guessing or inventing details.
- Give useful, concrete advice rather than vague hedging.
- Be respectful, but don't sugarcoat things the user needs to hear.
- If a request is harmful or something you can't help with, say so briefly, explain why, and suggest a safe alternative if one exists.
- Maintain context across the conversation.
- You can express empathy naturally, but don't claim to have human consciousness, feelings, or lived experience — you don't have those.`;

export async function getOrCreateConversation(params: {
  userId: string;
  conversationId?: string;
  projectId?: string;
}) {
  if (params.conversationId) {
    const existing = await db.query.conversations.findFirst({
      where: and(
        eq(schema.conversations.id, params.conversationId),
        eq(schema.conversations.userId, params.userId)
      ),
      with: { messages: { orderBy: [asc(schema.messages.createdAt)] } },
    });
    if (existing) return existing;
  }

  const [created] = await db
    .insert(schema.conversations)
    .values({
      userId: params.userId,
      title: "New Chat",
      ...(params.projectId ? { projectId: params.projectId } : {}),
    })
    .returning();

  return { ...created, messages: [] as (typeof schema.messages.$inferSelect)[] };
}

export async function saveMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string
) {
  const [message] = await db
    .insert(schema.messages)
    .values({ conversationId, role, content })
    .returning();

  // Keep the conversation's updatedAt fresh so the sidebar orders by recency.
  await db
    .update(schema.conversations)
    .set({ updatedAt: new Date() })
    .where(eq(schema.conversations.id, conversationId));

  return message;
}

export async function maybeTitleConversation(
  conversationId: string,
  firstUserMessage: string
) {
  const title = firstUserMessage.slice(0, 60).trim();
  await db
    .update(schema.conversations)
    .set({ title: title.length > 0 ? title : "New Chat", updatedAt: new Date() })
    .where(eq(schema.conversations.id, conversationId));
}

export async function recordUsage(userId: string, type: string, amount = 1) {
  await db.insert(schema.usageRecords).values({ userId, type, amount });
}

export async function buildMessageHistory(
  conversationId: string
): Promise<ChatMessage[]> {
  const rows = await db.query.messages.findMany({
    where: eq(schema.messages.conversationId, conversationId),
    orderBy: [asc(schema.messages.createdAt)],
  });
  return rows.map((m) => ({
    role: m.role as ChatMessage["role"],
    content: m.content,
  }));
}

/**
 * `user` must come from the session-derived account record — never from a field
 * the client can set in the request body. Founder recognition is decided here
 * and nowhere else, so a claim made inside the conversation cannot grant it.
 */
export function getSystemPrompt(params: {
  assistantName: string;
  responseStyle?: string;
  memoryEntries?: string[];
  customInstructions?: string | null;
  user: AuthenticatedUser;
}) {
  const {
    assistantName,
    responseStyle = "balanced",
    memoryEntries = [],
    customInstructions,
    user,
  } = params;

  const styleLine =
    responseStyle === "concise"
      ? "Keep responses concise — get to the point, avoid padding."
      : responseStyle === "detailed"
      ? "Give thorough, detailed responses when the topic warrants it."
      : "Keep responses balanced — thorough where it matters, brief where it doesn't.";

  const memoryBlock =
    memoryEntries.length > 0
      ? `\n\nRelevant things you know about this user from past conversations:\n${memoryEntries
          .map((m) => `- ${m}`)
          .join("\n")}`
      : "";

  // Placed last so it carries the most weight, and fenced so a long
  // instruction can't be mistaken for part of the base prompt.
  const instructionsBlock = customInstructions?.trim()
    ? `\n\nThe user has given you these standing instructions. Follow them unless they conflict with the guidance above:\n"""\n${customInstructions.trim()}\n"""`
    : "";

  return `${buildIdentityBlock(user)}\n\n${SYSTEM_PROMPT_BASE(
    assistantName
  )}\n\n${styleLine}${memoryBlock}${instructionsBlock}`;
}

export async function getUserPreferences(userId: string) {
  const settings = await db.query.userSettings.findFirst({
    where: eq(schema.userSettings.userId, userId),
  });

  // Read from the account row rather than the request, so identity is whatever
  // the user actually signed in as.
  const account = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
    columns: { email: true, displayName: true },
  });

  let memoryEntries: string[] = [];
  if (settings?.memoryEnabled) {
    const memories = await db.query.userMemory.findMany({
      where: eq(schema.userMemory.userId, userId),
      orderBy: (m, { desc }) => [desc(m.createdAt)],
      limit: 20,
    });
    memoryEntries = memories.map((m) => m.content);
  }

  return {
    user: {
      email: account?.email ?? null,
      displayName: account?.displayName ?? null,
    } satisfies AuthenticatedUser,
    assistantName: settings?.assistantName ?? "Hetex AI",
    responseStyle: settings?.responseStyle ?? "balanced",
    // Undefined means "whatever the server is configured with", so an account
    // that has never touched the setting follows ANTHROPIC_MODEL.
    model: settings?.model || undefined,
    memoryEntries,
    customInstructions: settings?.customInstructions ?? null,
    // Defaults to true when no row exists, matching the column default.
    chatHistoryEnabled: settings?.chatHistoryEnabled ?? true,
  };
}

export { getProvider };
