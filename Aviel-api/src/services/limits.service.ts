// Aviel AI — usage limits.
//
// Limits are set by an administrator and enforced here, server-side, on the
// request path. The client is told what the limits are so it can show progress
// and disable a control before you hit the wall — but the client being wrong,
// patched, or bypassed entirely changes nothing, because this is the check that
// actually refuses.

import { and, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "../db";
import { getPlatformConfig, type PlatformConfig } from "../settings/platform";

export type UsageType = "message" | "image" | "voice" | "tool_call" | "token";

export interface LimitState {
  type: UsageType;
  used: number;
  /** 0 means no ceiling. */
  limit: number;
  remaining: number | null;
  exceeded: boolean;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Usage recorded for this account since local midnight, by type. */
export async function usageToday(
  userId: string
): Promise<Record<string, number>> {
  const rows = await db
    .select({
      type: schema.usageRecords.type,
      total: sql<number>`coalesce(sum(${schema.usageRecords.amount}), 0)::int`,
    })
    .from(schema.usageRecords)
    .where(
      and(
        eq(schema.usageRecords.userId, userId),
        gte(schema.usageRecords.createdAt, startOfToday())
      )
    )
    .groupBy(schema.usageRecords.type);

  return Object.fromEntries(rows.map((r) => [r.type, r.total]));
}

const LIMIT_FOR: Record<string, keyof PlatformConfig["limits"]> = {
  message: "messagesPerDay",
  image: "imageGenerationsPerDay",
  voice: "voiceMinutesPerDay",
};

/** Every limit that applies to this account today, whether or not it is close. */
export async function limitStates(userId: string): Promise<LimitState[]> {
  const [config, used] = await Promise.all([
    getPlatformConfig(),
    usageToday(userId),
  ]);

  return (Object.keys(LIMIT_FOR) as UsageType[]).map((type) => {
    const limit = config.limits[LIMIT_FOR[type]];
    const count = used[type] ?? 0;
    return {
      type,
      used: count,
      limit,
      remaining: limit > 0 ? Math.max(0, limit - count) : null,
      exceeded: limit > 0 && count >= limit,
    };
  });
}

/**
 * Whether one more unit of this kind is allowed right now.
 *
 * Returns a message rather than a boolean so the refusal explains itself — "you
 * have used your 20 messages for today" is actionable in a way that a bare 429
 * is not.
 */
export async function checkLimit(
  userId: string,
  type: UsageType
): Promise<{ allowed: true } | { allowed: false; message: string; limit: number }> {
  const config = await getPlatformConfig();
  const key = LIMIT_FOR[type];
  if (!key) return { allowed: true };

  const limit = config.limits[key];
  if (limit <= 0) return { allowed: true };

  const used = (await usageToday(userId))[type] ?? 0;
  if (used < limit) return { allowed: true };

  const noun =
    type === "message"
      ? "messages"
      : type === "image"
        ? "image generations"
        : "voice minutes";

  return {
    allowed: false,
    limit,
    message: `You have used all ${limit} ${noun} allowed today. The limit resets at midnight.`,
  };
}
