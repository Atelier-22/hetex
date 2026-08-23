import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "../db";
import { requireAuth, asyncHandler } from "../auth/middleware";

export const memoryRouter = Router();

memoryRouter.use(requireAuth);

memoryRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const entries = await db.query.userMemory.findMany({
      where: eq(schema.userMemory.userId, req.userId!),
      orderBy: [desc(schema.userMemory.createdAt)],
    });
    res.json(entries);
  })
);

memoryRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const content =
      typeof req.body?.content === "string" ? req.body.content.trim() : "";

    if (!content) {
      res.status(400).json({ error: "Memory content is required" });
      return;
    }

    const [entry] = await db
      .insert(schema.userMemory)
      .values({ userId: req.userId!, content, source: "manual" })
      .returning();

    res.status(201).json(entry);
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
