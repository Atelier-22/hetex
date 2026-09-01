import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "../db";
import { requireAuth, asyncHandler } from "../auth/middleware";

export const libraryRouter = Router();
export const usageRouter = Router();
export const feedbackRouter = Router();

libraryRouter.use(requireAuth);
usageRouter.use(requireAuth);
feedbackRouter.use(requireAuth);

libraryRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const assets = await db.query.libraryAssets.findMany({
      where: eq(schema.libraryAssets.userId, req.userId!),
      orderBy: [desc(schema.libraryAssets.createdAt)],
    });
    res.json(assets);
  })
);

usageRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const records = await db.query.usageRecords.findMany({
      where: eq(schema.usageRecords.userId, req.userId!),
    });

    const totals: Record<string, number> = {};
    for (const r of records) {
      totals[r.type] = (totals[r.type] ?? 0) + r.amount;
    }

    res.json({ totals, plan: "Free" });
  })
);

feedbackRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const { messageId, conversationId, rating } = req.body ?? {};

    if (
      typeof messageId !== "string" ||
      !messageId ||
      (rating !== "up" && rating !== "down")
    ) {
      res.status(400).json({ error: "Invalid feedback payload" });
      return;
    }

    await db.insert(schema.messageFeedback).values({
      userId: req.userId!,
      messageId,
      conversationId: typeof conversationId === "string" ? conversationId : null,
      rating,
    });

    res.json({ success: true });
  })
);
