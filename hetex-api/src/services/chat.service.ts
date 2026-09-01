import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "../db";
import { getProvider, type ChatMessage } from "../ai";
import { type AuthenticatedUser } from "../ai/owner";
import { loadSettings } from "../settings/store";
import { MEMORY_CATEGORIES, type UserSettings } from "../settings/schema";
import { buildSystemPrompt } from "./prompt.service";

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

export interface ChatContext {
  user: AuthenticatedUser;
  settings: UserSettings;
  memoryEntries: string[];
}

/**
 * Everything a chat turn needs to know about the account.
 *
 * Memory is read here rather than in the prompt builder so that the memory
 * settings — whether it is on at all, which categories are wanted, and how many
 * entries may be injected — are applied at the point the data is fetched. A
 * category the user has switched off is never loaded, so it cannot leak into a
 * prompt by accident later.
 */
export async function getChatContext(userId: string): Promise<ChatContext> {
  const [settings, account] = await Promise.all([
    loadSettings(userId),
    // Read from the account row rather than the request, so identity is
    // whatever the user actually signed in as.
    db.query.users.findFirst({
      where: eq(schema.users.id, userId),
      columns: { email: true, displayName: true },
    }),
  ]);

  return {
    user: {
      email: account?.email ?? null,
      displayName: account?.displayName ?? null,
    } satisfies AuthenticatedUser,
    settings,
    memoryEntries: await loadMemoryForPrompt(userId, settings),
  };
}

/** Which memory categories this account has agreed to have recalled. */
export function enabledMemoryCategories(settings: UserSettings): string[] {
  const m = settings.memory;
  const wanted: Record<(typeof MEMORY_CATEGORIES)[number], boolean> = {
    preferences: m.rememberPreferences,
    projects: m.rememberProjects,
    personalization: m.rememberPersonal,
    conversation: m.rememberConversationContext,
  };
  return MEMORY_CATEGORIES.filter((c) => wanted[c]);
}

async function loadMemoryForPrompt(
  userId: string,
  settings: UserSettings
): Promise<string[]> {
  if (!settings.memory.enabled) return [];

  const categories = enabledMemoryCategories(settings);
  if (categories.length === 0) return [];

  const rows = await db.query.userMemory.findMany({
    where: and(
      eq(schema.userMemory.userId, userId),
      inArray(schema.userMemory.category, categories)
    ),
    orderBy: [desc(schema.userMemory.createdAt)],
    limit: settings.memory.maxEntriesInPrompt,
  });

  return rows.map((m) => m.content);
}

export { getProvider, buildSystemPrompt };
