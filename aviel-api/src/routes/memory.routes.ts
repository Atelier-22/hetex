import { Router } from "express";
import { z } from "zod";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "../db";
import { requireAuth, asyncHandler } from "../auth/middleware";
import { MEMORY_CATEGORIES, type MemoryCategory } from "../settings/schema";
import { getPlatformConfig } from "../settings/platform";
import { loadSettings } from "../settings/store";

export const memoryRouter = Router();

memoryRouter.use(requireAuth);

const categorySchema = z.enum(MEMORY_CATEGORIES);

const entrySchema = z.object({
  content: z.string().min(1).max(500),
  category: categorySchema.default("preferences"),
});

memoryRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const filter = req.query.category;
    const categories =
      typeof filter === "string" && MEMORY_CATEGORIES.includes(filter as MemoryCategory)
        ? [filter as MemoryCategory]
        : [...MEMORY_CATEGORIES];

    const entries = await db.query.userMemory.findMany({
      where: and(
        eq(schema.userMemory.userId, req.userId!),
        inArray(schema.userMemory.category, categories)
      ),
      orderBy: [desc(schema.userMemory.createdAt)],
    });

    const settings = await loadSettings(req.userId!);

    res.json({
      entries,
      // Which categories are being recalled right now, so the UI can mark an
      // entry as stored-but-not-in-use rather than implying it is active.
      enabled: settings.memory.enabled,
      categories: MEMORY_CATEGORIES.map((id) => ({
        id,
        active:
          settings.memory.enabled &&
          {
            preferences: settings.memory.rememberPreferences,
            projects: settings.memory.rememberProjects,
            personalization: settings.memory.rememberPersonal,
            conversation: settings.memory.rememberConversationContext,
          }[id],
        count: entries.filter((e) => e.category === id).length,
      })),
    });
  })
);

memoryRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = entrySchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: parsed.error.issues[0]?.message ?? "Invalid memory" });
      return;
    }

    const config = await getPlatformConfig();
    const existing = await db.$count(
      schema.userMemory,
      eq(schema.userMemory.userId, req.userId!)
    );

    if (existing >= config.limits.maxMemoryEntries) {
      res.status(409).json({
        error: `You have reached the limit of ${config.limits.maxMemoryEntries} saved memories. Delete some to add more.`,
      });
      return;
    }

    const [entry] = await db
      .insert(schema.userMemory)
      .values({
        userId: req.userId!,
        content: parsed.data.content.trim(),
        category: parsed.data.category,
        source: "manual",
      })
      .returning();

    res.status(201).json(entry);
  })
);

/** Edit a memory in place, rather than deleting and re-adding it. */
memoryRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const parsed = entrySchema.partial().safeParse(req.body);
    if (!parsed.success || Object.keys(parsed.data).length === 0) {
      res.status(400).json({
        error: parsed.success
          ? "Nothing to change"
          : (parsed.error.issues[0]?.message ?? "Invalid memory"),
      });
      return;
    }

    const [updated] = await db
      .update(schema.userMemory)
      .set({
        ...(parsed.data.content !== undefined
          ? { content: parsed.data.content.trim() }
          : {}),
        ...(parsed.data.category !== undefined
          ? { category: parsed.data.category }
          : {}),
        // An edited memory is the user's own words now, whatever wrote it first.
        source: "manual",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.userMemory.id, req.params.id),
          eq(schema.userMemory.userId, req.userId!)
        )
      )
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(updated);
  })
);

memoryRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const deleted = await db
      .delete(schema.userMemory)
      .where(
        and(
          eq(schema.userMemory.id, req.params.id),
          eq(schema.userMemory.userId, req.userId!)
        )
      )
      .returning({ id: schema.userMemory.id });

    if (deleted.length === 0) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ success: true });
  })
);

/** Delete everything, or one category. */
memoryRouter.post(
  "/clear",
  asyncHandler(async (req, res) => {
    const raw = req.body?.category;
    const category =
      typeof raw === "string" && MEMORY_CATEGORIES.includes(raw as MemoryCategory)
        ? (raw as MemoryCategory)
        : null;

    const deleted = await db
      .delete(schema.userMemory)
      .where(
        category
          ? and(
              eq(schema.userMemory.userId, req.userId!),
              eq(schema.userMemory.category, category)
            )
          : eq(schema.userMemory.userId, req.userId!)
      )
      .returning({ id: schema.userMemory.id });

    res.json({ success: true, deleted: deleted.length, category });
  })
);
