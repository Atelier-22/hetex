import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import { requireAuth, asyncHandler } from "../auth/middleware";

export const billingRouter = Router();

billingRouter.use(requireAuth);

/**
 * Plan state.
 *
 * There is no payment processor and no subscription record — every account is
 * on the same free early-access plan. This endpoint reports that plainly, with
 * `paidPlansAvailable: false`, so the UI can disable an Upgrade button rather
 * than linking to a checkout that does not exist.
 *
 * When billing is built, this is where a Stripe subscription lookup goes; the
 * response shape does not need to change.
 */
billingRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, req.userId!),
      columns: { createdAt: true },
    });

    const records = await db.query.usageRecords.findMany({
      where: eq(schema.usageRecords.userId, req.userId!),
      columns: { type: true, amount: true },
    });

    const totals: Record<string, number> = {};
    for (const r of records) totals[r.type] = (totals[r.type] ?? 0) + r.amount;

    res.json({
      plan: "Free",
      planLabel: "Early access",
      description: "Hetex AI is free while in early access.",
      memberSince: user?.createdAt ?? null,
      paidPlansAvailable: false,
      invoices: [],
      usage: { messages: totals.message ?? 0 },
    });
  })
);
