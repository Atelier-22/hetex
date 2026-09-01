import { Router } from "express";
import { and, asc, desc, eq } from "drizzle-orm";
import { db, schema } from "../db";
import { requireAuth, asyncHandler } from "../auth/middleware";

export const conversationsRouter = Router();

conversationsRouter.use(requireAuth);

conversationsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const conversations = await db.query.conversations.findMany({
      where: eq(schema.conversations.userId, req.userId!),
      // Pinned first, then most recently active. Ordering here rather than in
      // the client keeps every caller — web, mobile, future ones — consistent.
      orderBy: [
        desc(schema.conversations.pinned),
        desc(schema.conversations.updatedAt),
      ],
      columns: {
        id: true,
        title: true,
        updatedAt: true,
        projectId: true,
        pinned: true,
      },
    });
    res.json(conversations);
  })
);

conversationsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const conversation = await db.query.conversations.findFirst({
      where: and(
        eq(schema.conversations.id, req.params.id),
        eq(schema.conversations.userId, req.userId!)
      ),
      with: { messages: { orderBy: [asc(schema.messages.createdAt)] } },
    });

    if (!conversation) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(conversation);
  })
);

conversationsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const title = typeof req.body?.title === "string" ? req.body.title : null;
    const pinned =
      typeof req.body?.pinned === "boolean" ? req.body.pinned : undefined;

    if (title !== null && !title.trim()) {
      res.status(400).json({ error: "A title cannot be empty" });
      return;
    }
    if (title === null && pinned === undefined) {
      res.status(400).json({ error: "Nothing to update" });
      return;
    }

    const updated = await db
      .update(schema.conversations)
      .set({
        ...(title ? { title: title.trim() } : {}),
        ...(pinned !== undefined ? { pinned } : {}),
        // Pinning shouldn't reorder the list as if the chat had new activity.
        ...(title ? { updatedAt: new Date() } : {}),
      })
      .where(
        and(
          eq(schema.conversations.id, req.params.id),
          eq(schema.conversations.userId, req.userId!)
        )
      )
      .returning();

    if (updated.length === 0) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ success: true });
  })
);

conversationsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const deleted = await db
      .delete(schema.conversations)
      .where(
        and(
          eq(schema.conversations.id, req.params.id),
          eq(schema.conversations.userId, req.userId!)
        )
      )
      .returning({ id: schema.conversations.id });

    if (deleted.length === 0) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ success: true });
  })
);
