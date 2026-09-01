import os from "node:os";
import { Router } from "express";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "../db";
import { requireAuth, asyncHandler } from "../auth/middleware";
import { availableModels, configuredProviders } from "../ai";
import { getLocalRuntimeStatus } from "../ai/local-runtime";
import { getPlatformConfig } from "../settings/platform";
import { APP_VERSION, BUILD_ID, BUILT_AT, SETTINGS_SCHEMA_VERSION } from "../version";

export const systemRouter = Router();

/**
 * About Aviel AI.
 *
 * Public, and deliberately vague about nothing: version, build, and which
 * subsystems are actually running. It names no vendor — the model tiers are
 * described by capability, matching what the assistant itself will say.
 */
systemRouter.get(
  "/about",
  asyncHandler(async (_req, res) => {
    const [local, config] = await Promise.all([
      getLocalRuntimeStatus(),
      getPlatformConfig(),
    ]);

    let databaseVersion: string | null = null;
    let migrationCount: number | null = null;
    try {
      const [v] = await db.execute<{ version: string }>(
        sql`select version() as version`
      ).then((r) => (r as unknown as { rows: { version: string }[] }).rows ?? []);
      databaseVersion = v?.version?.split(",")[0] ?? null;

      const [m] = await db
        .execute<{ n: number }>(
          sql`select count(*)::int as n from drizzle.__drizzle_migrations`
        )
        .then((r) => (r as unknown as { rows: { n: number }[] }).rows ?? []);
      migrationCount = m?.n ?? null;
    } catch {
      // Reporting "unknown" is correct here; inventing a version is not.
    }

    res.json({
      name: "Aviel AI",
      version: APP_VERSION,
      build: BUILD_ID,
      builtAt: BUILT_AT,
      settingsSchemaVersion: SETTINGS_SCHEMA_VERSION,

      engine: {
        hostedModels: availableModels().filter((m) => !m.local).length,
        hostedConfigured: configuredProviders().some((p) => p.id !== "local"),
        localRuntime: local.runtime,
        localModels: local.models.map((m) => ({
          name: m.name,
          sizeBytes: m.sizeBytes,
          contextLength: m.contextLength,
        })),
      },

      database: { version: databaseVersion, migrations: migrationCount },

      features: config.features,

      legal: {
        terms: "/terms",
        privacy: "/privacy",
        licenses: "/licenses",
      },
    });
  })
);

/**
 * Diagnostics.
 *
 * What a support conversation actually needs: whether the pieces are reachable
 * and how long they take. Contains no user data and no secrets — a key is
 * reported as present or absent, never echoed.
 */
systemRouter.get(
  "/diagnostics",
  requireAuth,
  asyncHandler(async (_req, res) => {
    const checks: {
      id: string;
      label: string;
      status: "ok" | "degraded" | "unavailable";
      detail: string;
      ms?: number;
    }[] = [];

    const dbStart = Date.now();
    try {
      await db.execute(sql`select 1`);
      checks.push({
        id: "database",
        label: "Database",
        status: "ok",
        detail: "Reachable",
        ms: Date.now() - dbStart,
      });
    } catch (err) {
      checks.push({
        id: "database",
        label: "Database",
        status: "unavailable",
        detail: err instanceof Error ? err.message : "Not reachable",
        ms: Date.now() - dbStart,
      });
    }

    const hosted = configuredProviders().filter((p) => p.id !== "local");
    checks.push({
      id: "hosted-ai",
      label: "Hosted AI",
      status: hosted.length > 0 ? "ok" : "unavailable",
      detail:
        hosted.length > 0
          ? `${hosted.length} provider${hosted.length === 1 ? "" : "s"} configured`
          : "No API key is set on this server",
    });

    const local = await getLocalRuntimeStatus();
    checks.push({
      id: "local-ai",
      label: "Local AI",
      status: local.available ? "ok" : "unavailable",
      detail: local.available
        ? `${local.runtime}, ${local.models.length} model${local.models.length === 1 ? "" : "s"}`
        : (local.requirement ?? "No local runtime"),
    });

    checks.push({
      id: "notifications",
      label: "Notification delivery",
      status: "unavailable",
      detail: "No push service or mail transport is configured",
    });

    checks.push({
      id: "billing",
      label: "Payments",
      status: (await getPlatformConfig()).billingConfigured ? "ok" : "unavailable",
      detail: "No payment processor is connected",
    });

    res.json({
      generatedAt: new Date().toISOString(),
      version: APP_VERSION,
      build: BUILD_ID,
      runtime: {
        node: process.version,
        platform: `${os.type()} ${os.release()}`,
        uptimeSeconds: Math.round(process.uptime()),
        memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      },
      checks,
    });
  })
);

/* -------------------------------------------------------------------------- */
/* Help & Support                                                             */
/* -------------------------------------------------------------------------- */

const reportSchema = z.object({
  kind: z.enum(["bug", "ai_response", "safety", "feedback", "contact"]),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
  /** Optional context: the message being reported, diagnostics the user agreed to send. */
  meta: z.record(z.unknown()).optional(),
});

/**
 * Support reports.
 *
 * Stored in the database and listed in the admin dashboard. There is no mail
 * transport, so nothing is emailed anywhere — the response says so, rather than
 * claiming a ticket was sent to a support address that does not exist.
 */
systemRouter.post(
  "/reports",
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = reportSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: parsed.error.issues[0]?.message ?? "Invalid report" });
      return;
    }

    const [row] = await db
      .insert(schema.supportReports)
      .values({
        userId: req.userId!,
        kind: parsed.data.kind,
        subject: parsed.data.subject.trim(),
        body: parsed.data.body.trim(),
        meta: {
          ...(parsed.data.meta ?? {}),
          version: APP_VERSION,
          build: BUILD_ID,
          receivedAt: new Date().toISOString(),
        },
      })
      .returning({ id: schema.supportReports.id });

    res.status(201).json({
      id: row.id,
      delivered: false,
      // Said plainly, because the alternative is someone waiting for a reply
      // that was never going to come.
      note: "Your report is stored and visible to the Aviel team in the admin dashboard. Email replies aren't set up yet, so you won't get a response by email.",
    });
  })
);

systemRouter.get(
  "/reports",
  requireAuth,
  asyncHandler(async (req, res) => {
    const rows = await db.query.supportReports.findMany({
      where: eq(schema.supportReports.userId, req.userId!),
      orderBy: (r, { desc }) => [desc(r.createdAt)],
      limit: 25,
      columns: { id: true, kind: true, subject: true, status: true, createdAt: true },
    });
    res.json(rows);
  })
);
