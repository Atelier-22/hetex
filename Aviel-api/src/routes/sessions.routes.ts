import { Router } from "express";
import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "../db";
import { requireAuth, asyncHandler } from "../auth/middleware";
import {
  SESSION_TYPES,
  SESSION_TYPE_META,
  generateSessionSummary,
  listSessions,
  sessionDuration,
} from "../services/session.service";
import { availableModels } from "../ai";
import { loadSettings } from "../settings/store";
import { getPlatformConfig } from "../settings/platform";

export const sessionsRouter = Router();

sessionsRouter.use(requireAuth);

const typeEnum = z.enum(SESSION_TYPES);

/** Shape returned to the client. Duration is computed, never stored stale. */
function present(session: typeof schema.sessions.$inferSelect) {
  return {
    ...session,
    durationSeconds: sessionDuration(session),
    typeLabel: SESSION_TYPE_META[session.type as keyof typeof SESSION_TYPE_META]
      ?.label ?? session.type,
  };
}

/** The catalogue, so the client never hardcodes a list the server owns. */
sessionsRouter.get("/types", (_req, res) => {
  res.json(
    SESSION_TYPES.map((id) => ({
      id,
      label: SESSION_TYPE_META[id].label,
      description: SESSION_TYPE_META[id].description,
    }))
  );
});

sessionsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const rows = await listSessions(req.userId!);
    res.json(rows.map(present));
  })
);

const createSchema = z.object({
  type: typeEnum.default("chat"),
  title: z.string().min(1).max(120).optional(),
  projectId: z.string().optional(),
  temporary: z.boolean().default(false),
  thinkMode: z.enum(["fast", "balanced", "deep"]).optional(),
  model: z.string().max(80).nullable().optional(),
});

/**
 * Start a session.
 *
 * A conversation is created alongside it, so the session has somewhere for its
 * messages to live from the first turn rather than materialising one later.
 */
sessionsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: parsed.error.issues[0]?.message ?? "Invalid session" });
      return;
    }

    const settings = await loadSettings(req.userId!);
    const config = await getPlatformConfig();

    if (!config.features.chat) {
      res.status(503).json({
        error: "Sessions are unavailable while chat is turned off on this server.",
      });
      return;
    }

    const model = parsed.data.model ?? settings.ai.defaultModel;
    if (model && !availableModels().some((m) => m.value === model)) {
      res.status(400).json({ error: "That model isn't available on this server." });
      return;
    }

    // A temporary session is honoured whatever the account's history setting
    // says; it is the stricter of the two, never the looser.
    const temporary =
      parsed.data.temporary || !settings.conversation.saveConversations;

    const [conversation] = await db
      .insert(schema.conversations)
      .values({
        userId: req.userId!,
        title: parsed.data.title ?? `${SESSION_TYPE_META[parsed.data.type].label} session`,
        model,
        ...(parsed.data.projectId ? { projectId: parsed.data.projectId } : {}),
      })
      .returning();

    const [session] = await db
      .insert(schema.sessions)
      .values({
        userId: req.userId!,
        conversationId: conversation.id,
        ...(parsed.data.projectId ? { projectId: parsed.data.projectId } : {}),
        title: parsed.data.title ?? `${SESSION_TYPE_META[parsed.data.type].label} session`,
        type: parsed.data.type,
        model,
        thinkMode: parsed.data.thinkMode ?? settings.ai.thinkMode,
        temporary,
      })
      .returning();

    res.status(201).json({ ...present(session), conversationId: conversation.id });
  })
);

sessionsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const session = await db.query.sessions.findFirst({
      where: and(
        eq(schema.sessions.id, req.params.id),
        eq(schema.sessions.userId, req.userId!)
      ),
    });

    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    const messages = session.conversationId
      ? await db.query.messages.findMany({
          where: eq(schema.messages.conversationId, session.conversationId),
          orderBy: [asc(schema.messages.createdAt)],
        })
      : [];

    res.json({ ...present(session), messages });
  })
);

const patchSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  type: typeEnum.optional(),
  thinkMode: z.enum(["fast", "balanced", "deep"]).optional(),
  temporary: z.boolean().optional(),
});

sessionsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const parsed = patchSchema.safeParse(req.body ?? {});
    if (!parsed.success || Object.keys(parsed.data).length === 0) {
      res.status(400).json({
        error: parsed.success
          ? "Nothing to change"
          : (parsed.error.issues[0]?.message ?? "Invalid change"),
      });
      return;
    }

    const [updated] = await db
      .update(schema.sessions)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(
        and(
          eq(schema.sessions.id, req.params.id),
          eq(schema.sessions.userId, req.userId!)
        )
      )
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    // Renaming the session renames the conversation it wraps, so the sidebar
    // and the session list do not disagree about what this thing is called.
    if (parsed.data.title && updated.conversationId) {
      await db
        .update(schema.conversations)
        .set({ title: parsed.data.title, updatedAt: new Date() })
        .where(eq(schema.conversations.id, updated.conversationId));
    }

    res.json(present(updated));
  })
);

/** Forget what the session has established, without ending it. */
sessionsRouter.post(
  "/:id/clear-context",
  asyncHandler(async (req, res) => {
    const [updated] = await db
      .update(schema.sessions)
      .set({ contextNotes: [], updatedAt: new Date() })
      .where(
        and(
          eq(schema.sessions.id, req.params.id),
          eq(schema.sessions.userId, req.userId!)
        )
      )
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    res.json(present(updated));
  })
);

sessionsRouter.post(
  "/:id/summary",
  asyncHandler(async (req, res) => {
    const summary = await generateSessionSummary(req.params.id, req.userId!);

    if (summary === null) {
      res.status(422).json({
        error:
          "There isn't enough in this session to summarise yet. Have a few exchanges first.",
      });
      return;
    }

    res.json({ summary });
  })
);

const endSchema = z.object({
  /** Generate a summary as part of ending. Off by default: it costs a request. */
  summarize: z.boolean().default(false),
});

sessionsRouter.post(
  "/:id/end",
  asyncHandler(async (req, res) => {
    const parsed = endSchema.safeParse(req.body ?? {});
    const summarize = parsed.success ? parsed.data.summarize : false;

    const session = await db.query.sessions.findFirst({
      where: and(
        eq(schema.sessions.id, req.params.id),
        eq(schema.sessions.userId, req.userId!)
      ),
    });

    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    if (session.state === "ended") {
      res.json({ ...present(session), alreadyEnded: true });
      return;
    }

    // Summarise before marking it ended, so the summary sees a session that is
    // still coherent rather than one mid-transition.
    let summary: string | null = null;
    if (summarize) {
      summary = await generateSessionSummary(session.id, req.userId!).catch(
        () => null
      );
    }

    const [ended] = await db
      .update(schema.sessions)
      .set({ state: "ended", endedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.sessions.id, session.id))
      .returning();

    res.json({
      ...present(ended),
      summary,
      // The client asks before deleting; the server does not decide for it.
      promptToDelete: ended.temporary,
    });
  })
);

const deleteSchema = z.object({
  /** Also remove the conversation and its messages. */
  deleteConversation: z.boolean().default(false),
});

sessionsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const parsed = deleteSchema.safeParse(req.body ?? {});
    const alsoConversation = parsed.success
      ? parsed.data.deleteConversation
      : false;

    const session = await db.query.sessions.findFirst({
      where: and(
        eq(schema.sessions.id, req.params.id),
        eq(schema.sessions.userId, req.userId!)
      ),
    });

    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    await db.delete(schema.sessions).where(eq(schema.sessions.id, session.id));

    // Deleting the session frame is not the same as deleting the conversation.
    // Only remove the messages when that was explicitly asked for.
    if (alsoConversation && session.conversationId) {
      await db
        .delete(schema.conversations)
        .where(eq(schema.conversations.id, session.conversationId));
    }

    res.json({ success: true, conversationDeleted: alsoConversation });
  })
);
