import { Router } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import { requireAuth, asyncHandler } from "../auth/middleware";

export const settingsRouter = Router();

settingsRouter.use(requireAuth);

// Models the user is allowed to pick. Anything outside this list is rejected
// rather than passed through to the provider — an arbitrary string here would
// become a 400 from Anthropic at send time, long after the mistake was made.
export const ALLOWED_MODELS = [
  "claude-sonnet-4-6",
  "claude-opus-5",
] as const;

const patchSchema = z.object({
  theme: z.enum(["system", "light", "dark"]).optional(),
  accentColor: z.enum(["green", "blue", "violet", "amber", "rose"]).optional(),
  textSize: z.enum(["small", "medium", "large"]).optional(),
  assistantName: z.string().min(1).max(80).optional(),
  responseStyle: z.enum(["concise", "balanced", "detailed"]).optional(),
  model: z.enum(ALLOWED_MODELS).optional(),
  memoryEnabled: z.boolean().optional(),
  enterToSend: z.boolean().optional(),
  dictationEnabled: z.boolean().optional(),
  voiceName: z.string().max(120).nullable().optional(),
});

settingsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    let settings = await db.query.userSettings.findFirst({
      where: eq(schema.userSettings.userId, req.userId!),
    });

    if (!settings) {
      [settings] = await db
        .insert(schema.userSettings)
        .values({ userId: req.userId! })
        .returning();
    }

    res.json(settings);
  })
);

settingsRouter.patch(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: parsed.error.issues[0]?.message ?? "Invalid settings" });
      return;
    }

    const patch = { ...parsed.data, updatedAt: new Date() };

    const existing = await db.query.userSettings.findFirst({
      where: eq(schema.userSettings.userId, req.userId!),
    });

    const [updated] = existing
      ? await db
          .update(schema.userSettings)
          .set(patch)
          .where(eq(schema.userSettings.userId, req.userId!))
          .returning()
      : await db
          .insert(schema.userSettings)
          .values({ userId: req.userId!, ...patch })
          .returning();

    res.json(updated);
  })
);
