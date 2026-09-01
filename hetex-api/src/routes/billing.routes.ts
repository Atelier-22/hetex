import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import { requireAuth, asyncHandler } from "../auth/middleware";
import { getPlatformConfig } from "../settings/platform";
import { limitStates, usageToday } from "../services/limits.service";

export const billingRouter = Router();

billingRouter.use(requireAuth);

/**
 * Plan, usage and limits.
 *
 * There is no payment processor and no subscription record — every account is
 * on the same free early-access plan, and `billingConfigured` says so. The
 * plan catalogue and the limits are real config an administrator owns, and the
 * usage figures are counted from usage_records rather than estimated.
 *
 * When billing is built, a subscription lookup goes here; the response shape
 * does not need to change.
 */
billingRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const [user, config, totals, today, limits] = await Promise.all([
      db.query.users.findFirst({
        where: eq(schema.users.id, req.userId!),
        columns: { createdAt: true },
      }),
      getPlatformConfig(),
      db.query.usageRecords.findMany({
        where: eq(schema.usageRecords.userId, req.userId!),
        columns: { type: true, amount: true },
      }),
      usageToday(req.userId!),
      limitStates(req.userId!),
    ]);

    const allTime: Record<string, number> = {};
    for (const r of totals) allTime[r.type] = (allTime[r.type] ?? 0) + r.amount;

    // Storage is measured, not guessed: message text plus the data URLs that
    // attachments are stored as.
    const [messages, assets] = await Promise.all([
      db
        .select({
          content: schema.messages.content,
          conversationId: schema.messages.conversationId,
        })
        .from(schema.messages)
        .innerJoin(
          schema.conversations,
          eq(schema.messages.conversationId, schema.conversations.id)
        )
        .where(eq(schema.conversations.userId, req.userId!)),
      db.query.libraryAssets.findMany({
        where: eq(schema.libraryAssets.userId, req.userId!),
        columns: { url: true },
      }),
    ]);

    const storageBytes =
      messages.reduce((n, m) => n + Buffer.byteLength(m.content, "utf8"), 0) +
      assets.reduce((n, a) => n + Buffer.byteLength(a.url ?? "", "utf8"), 0);

    const current = config.plans.find((p) => p.id === "free") ?? config.plans[0];

    res.json({
      plan: current?.name ?? "Free",
      planId: current?.id ?? "free",
      planLabel: config.billingConfigured ? "Current plan" : "Early access",
      description:
        current?.description ?? "Hetex AI is free while in early access.",
      memberSince: user?.createdAt ?? null,

      // Nothing about payments is claimed to work. The plan catalogue is shown
      // so people can see what is planned; every unavailable plan says so.
      paidPlansAvailable: config.plans.some((p) => p.available && p.id !== "free"),
      billingConfigured: config.billingConfigured,
      billingNote: config.billingConfigured
        ? null
        : "No payment processor is connected to this server, so there is nothing to charge and no invoices exist.",
      plans: config.plans,
      invoices: [],

      usage: {
        allTime: {
          messages: allTime.message ?? 0,
          images: allTime.image ?? 0,
          voice: allTime.voice ?? 0,
          toolCalls: allTime.tool_call ?? 0,
        },
        today: {
          messages: today.message ?? 0,
          images: today.image ?? 0,
          voice: today.voice ?? 0,
        },
        storageBytes,
        storageLimitBytes:
          config.limits.maxStorageMb > 0
            ? config.limits.maxStorageMb * 1_000_000
            : null,
      },

      limits,
    });
  })
);
