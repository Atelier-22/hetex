import { Router } from "express";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "../db";
import { asyncHandler } from "../auth/middleware";
import {
  requireAdmin,
  isAdminEmail,
  checkOwnerLogin,
  issueOwnerToken,
  ownerLoginConfigured,
} from "../auth/admin";
import { availableModels, providerStatus } from "../ai";
import { getLocalRuntimeStatus } from "../ai/local-runtime";
import {
  getPlatformConfig,
  platformConfigPatchSchema,
  savePlatformConfig,
} from "../settings/platform";
import { env } from "../env";

export const adminRouter = Router();

/**
 * Whether an owner login is configured at all.
 *
 * Reports only that the two variables are present and their lengths — never
 * the values. Without this, "not configured" and "wrong password" produce the
 * same 401 and there is no way to tell them apart from outside.
 */
adminRouter.get("/config-status", (_req, res) => {
  res.json({
    ownerLoginConfigured: ownerLoginConfigured(),
    adminEmailLength: (env.ADMIN_EMAIL || env.ADMIN_EMAILS.split(",")[0] || "").trim().length,
    adminPasswordLength: env.ADMIN_PASSWORD?.length ?? 0,
    // Surfaces the classic cause: a value pasted with a trailing space or
    // wrapped in quotes, which is invisible in a dashboard text field.
    adminEmailHasWhitespace: env.ADMIN_EMAIL
      ? env.ADMIN_EMAIL !== env.ADMIN_EMAIL.trim()
      : false,
    adminPasswordHasWhitespace: env.ADMIN_PASSWORD
      ? env.ADMIN_PASSWORD !== env.ADMIN_PASSWORD.trim()
      : false,
    adminPasswordLooksQuoted: env.ADMIN_PASSWORD
      ? /^["'].*["']$/.test(env.ADMIN_PASSWORD)
      : false,
  });
});

/**
 * Owner sign-in. Public by necessity — it is the door.
 *
 * One message for every failure, so it cannot be used to discover whether an
 * email is the admin one.
 */
adminRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const email = typeof req.body?.email === "string" ? req.body.email : "";
    const password =
      typeof req.body?.password === "string" ? req.body.password : "";

    if (!email || !password) {
      res.status(400).json({ error: "Enter your email and password" });
      return;
    }

    if (checkOwnerLogin(email, password)) {
      res.json({ token: issueOwnerToken() });
      return;
    }

    res
      .status(401)
      .json({ error: "Those details don't give access to the dashboard." });
  })
);

// Everything below requires admin.
adminRouter.use(requireAdmin);

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** `count(*)` with an optional filter, as a plain number. */
async function countOf(
  table: Parameters<typeof db.select>[0] extends never ? never : any,
  where?: any
): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(table)
    .where(where);
  return row?.n ?? 0;
}

/**
 * Aggregate view of the platform.
 *
 * Deliberately contains no message content and no conversation titles. Titles
 * are generated from a user's first message, so listing them would expose what
 * people are writing — which the privacy page says does not happen. Everything
 * here is counts and trends.
 */
adminRouter.get(
  "/overview",
  asyncHandler(async (_req, res) => {
    const today = startOfToday();
    const week = daysAgo(7);
    const month = daysAgo(30);

    const [
      totalUsers,
      newToday,
      newWeek,
      newMonth,
      signInsToday,
      activeToday,
      activeWeek,
      totalConversations,
      conversationsToday,
      totalMessages,
      messagesToday,
      thumbsUp,
      thumbsDown,
      totalProjects,
      totalAssets,
      memoryOn,
      historyOff,
    ] = await Promise.all([
      countOf(schema.users),
      countOf(schema.users, gte(schema.users.createdAt, today)),
      countOf(schema.users, gte(schema.users.createdAt, week)),
      countOf(schema.users, gte(schema.users.createdAt, month)),
      countOf(schema.userSessions, gte(schema.userSessions.createdAt, today)),
      // Distinct users, not sessions — one person on three devices is one
      // active user, and counting sessions would flatter the number.
      db
        .select({
          n: sql<number>`count(distinct ${schema.userSessions.userId})::int`,
        })
        .from(schema.userSessions)
        .where(gte(schema.userSessions.lastActiveAt, today))
        .then((r) => r[0]?.n ?? 0),
      db
        .select({
          n: sql<number>`count(distinct ${schema.userSessions.userId})::int`,
        })
        .from(schema.userSessions)
        .where(gte(schema.userSessions.lastActiveAt, week))
        .then((r) => r[0]?.n ?? 0),
      countOf(schema.conversations),
      countOf(schema.conversations, gte(schema.conversations.createdAt, today)),
      countOf(schema.messages),
      countOf(schema.messages, gte(schema.messages.createdAt, today)),
      countOf(schema.messageFeedback, eq(schema.messageFeedback.rating, "up")),
      countOf(schema.messageFeedback, eq(schema.messageFeedback.rating, "down")),
      countOf(schema.projects),
      countOf(schema.libraryAssets),
      countOf(schema.userSettings, eq(schema.userSettings.memoryEnabled, true)),
      countOf(
        schema.userSettings,
        eq(schema.userSettings.chatHistoryEnabled, false)
      ),
    ]);

    // Fourteen days of activity, filled so quiet days are zeros rather than
    // gaps — a chart that skips empty days misrepresents the trend.
    const since = daysAgo(13);
    const [signupSeries, messageSeries, signInSeries] = await Promise.all([
      db
        .select({
          day: sql<string>`to_char(date_trunc('day', ${schema.users.createdAt}), 'YYYY-MM-DD')`,
          n: sql<number>`count(*)::int`,
        })
        .from(schema.users)
        .where(gte(schema.users.createdAt, since))
        .groupBy(sql`1`),
      db
        .select({
          day: sql<string>`to_char(date_trunc('day', ${schema.messages.createdAt}), 'YYYY-MM-DD')`,
          n: sql<number>`count(*)::int`,
        })
        .from(schema.messages)
        .where(gte(schema.messages.createdAt, since))
        .groupBy(sql`1`),
      db
        .select({
          day: sql<string>`to_char(date_trunc('day', ${schema.userSessions.createdAt}), 'YYYY-MM-DD')`,
          n: sql<number>`count(*)::int`,
        })
        .from(schema.userSessions)
        .where(gte(schema.userSessions.createdAt, since))
        .groupBy(sql`1`),
    ]);

    const byDay = (rows: { day: string; n: number }[]) =>
      new Map(rows.map((r) => [r.day, r.n]));
    const signups = byDay(signupSeries);
    const msgs = byDay(messageSeries);
    const signIns = byDay(signInSeries);

    const series: {
      day: string;
      signups: number;
      messages: number;
      signIns: number;
    }[] = [];
    for (let i = 13; i >= 0; i--) {
      const key = daysAgo(i).toISOString().slice(0, 10);
      series.push({
        day: key,
        signups: signups.get(key) ?? 0,
        messages: msgs.get(key) ?? 0,
        signIns: signIns.get(key) ?? 0,
      });
    }

    // Which tier accounts are on. Legacy vendor ids are still stored on older
    // accounts, so they are grouped under their tier rather than shown raw.
    const tierRows = await db
      .select({
        model: schema.userSettings.model,
        n: sql<number>`count(*)::int`,
      })
      .from(schema.userSettings)
      .groupBy(schema.userSettings.model);

    const tiers = availableModels().map((m) => ({
      value: m.value,
      label: m.label,
      users: tierRows
        .filter((r) => r.model === m.value)
        .reduce((sum, r) => sum + r.n, 0),
    }));

    const feedbackTotal = thumbsUp + thumbsDown;

    res.json({
      users: {
        total: totalUsers,
        newToday,
        newWeek,
        newMonth,
        activeToday,
        activeWeek,
        signInsToday,
      },
      activity: {
        conversations: totalConversations,
        conversationsToday,
        messages: totalMessages,
        messagesToday,
        projects: totalProjects,
        assets: totalAssets,
        messagesPerUser:
          totalUsers > 0 ? Math.round((totalMessages / totalUsers) * 10) / 10 : 0,
      },
      feedback: {
        up: thumbsUp,
        down: thumbsDown,
        total: feedbackTotal,
        // Null rather than 0 when nobody has rated anything: "0% positive" and
        // "no ratings yet" are very different, and one of them is alarming.
        positiveRate:
          feedbackTotal > 0
            ? Math.round((thumbsUp / feedbackTotal) * 100)
            : null,
      },
      privacy: {
        memoryEnabled: memoryOn,
        chatHistoryDisabled: historyOff,
      },
      tiers,
      series,
      generatedAt: new Date().toISOString(),
    });
  })
);

/**
 * Recent accounts.
 *
 * Emails and activity only — no conversation titles, no message content.
 */
adminRouter.get(
  "/users",
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 25, 100);

    const rows = await db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        displayName: schema.users.displayName,
        role: schema.users.role,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users)
      .orderBy(desc(schema.users.createdAt))
      .limit(limit);

    // Per-user counts, resolved in two queries rather than one per row.
    const [messageCounts, lastActive] = await Promise.all([
      db
        .select({
          userId: schema.conversations.userId,
          n: sql<number>`count(${schema.messages.id})::int`,
        })
        .from(schema.conversations)
        .leftJoin(
          schema.messages,
          eq(schema.messages.conversationId, schema.conversations.id)
        )
        .groupBy(schema.conversations.userId),
      db
        .select({
          userId: schema.userSessions.userId,
          at: sql<string>`max(${schema.userSessions.lastActiveAt})`,
        })
        .from(schema.userSessions)
        .groupBy(schema.userSessions.userId),
    ]);

    const msgBy = new Map(messageCounts.map((r) => [r.userId, r.n]));
    const activeBy = new Map(lastActive.map((r) => [r.userId, r.at]));

    res.json(
      rows.map((u) => ({
        ...u,
        isAdmin: u.role === "admin" || isAdminEmail(u.email),
        messages: msgBy.get(u.id) ?? 0,
        lastActiveAt: activeBy.get(u.id) ?? null,
      }))
    );
  })
);

/** Promote or demote. An admin cannot remove their own access by accident. */
adminRouter.patch(
  "/users/:id/role",
  asyncHandler(async (req, res) => {
    const role = req.body?.role;
    if (role !== "admin" && role !== "user") {
      res.status(400).json({ error: "Role must be 'admin' or 'user'" });
      return;
    }

    if (req.params.id === req.userId) {
      res.status(400).json({ error: "You can't change your own role." });
      return;
    }

    const [updated] = await db
      .update(schema.users)
      .set({ role, updatedAt: new Date() })
      .where(eq(schema.users.id, req.params.id))
      .returning({ id: schema.users.id, role: schema.users.role });

    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(updated);
  })
);

/** Confirms a token is still an admin one. */
adminRouter.get(
  "/me",
  asyncHandler(async (req, res) => {
    res.json({ isAdmin: true, email: req.userEmail });
  })
);

/* -------------------------------------------------------------------------- */
/* Platform configuration                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The settings an administrator owns.
 *
 * Separate from user settings on purpose: nothing here is a personal
 * preference, and none of it is reachable from the user Settings screen. What
 * is set here constrains every account — a feature switched off disappears from
 * every user's Settings as unavailable, and a limit set here is enforced on the
 * request path regardless of what any client sends.
 */
adminRouter.get(
  "/config",
  asyncHandler(async (_req, res) => {
    const config = await getPlatformConfig();

    res.json({
      config,
      // Vendor names are admin-visible regardless of the reveal flag: an
      // operator has to know which service they are paying for.
      providers: providerStatus({ revealNames: true }),
      localAI: await getLocalRuntimeStatus(),
    });
  })
);

adminRouter.patch(
  "/config",
  asyncHandler(async (req, res) => {
    const parsed = platformConfigPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      res.status(400).json({
        error: issue?.message ?? "Invalid configuration",
        path: issue?.path.join("."),
      });
      return;
    }

    // Image generation cannot be switched on: no provider implements it, and a
    // flag that enables a button which then fails is worse than a flag that
    // refuses honestly.
    if (parsed.data.features?.imageGeneration) {
      res.status(409).json({
        error:
          "Image generation can't be enabled — no image generation provider is implemented on this server.",
        path: "features.imageGeneration",
      });
      return;
    }

    if (parsed.data.billingConfigured) {
      res.status(409).json({
        error:
          "Billing can't be marked configured — no payment processor is connected.",
        path: "billingConfigured",
      });
      return;
    }

    res.json({ config: await savePlatformConfig(parsed.data) });
  })
);

/** Support reports raised from Help & Support, newest first. */
adminRouter.get(
  "/reports",
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 50, 200);

    const rows = await db
      .select({
        id: schema.supportReports.id,
        kind: schema.supportReports.kind,
        subject: schema.supportReports.subject,
        body: schema.supportReports.body,
        status: schema.supportReports.status,
        createdAt: schema.supportReports.createdAt,
        userEmail: schema.users.email,
      })
      .from(schema.supportReports)
      .leftJoin(schema.users, eq(schema.supportReports.userId, schema.users.id))
      .orderBy(desc(schema.supportReports.createdAt))
      .limit(limit);

    res.json(rows);
  })
);

adminRouter.patch(
  "/reports/:id",
  asyncHandler(async (req, res) => {
    const status = req.body?.status;
    if (status !== "open" && status !== "closed") {
      res.status(400).json({ error: "Status must be 'open' or 'closed'" });
      return;
    }

    const [updated] = await db
      .update(schema.supportReports)
      .set({ status })
      .where(eq(schema.supportReports.id, req.params.id))
      .returning({ id: schema.supportReports.id, status: schema.supportReports.status });

    if (!updated) {
      res.status(404).json({ error: "Report not found" });
      return;
    }
    res.json(updated);
  })
);
