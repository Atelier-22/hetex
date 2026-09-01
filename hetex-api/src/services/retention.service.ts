// Hetex AI — retention.
//
// "Delete conversations after 30 days" is only a real setting if something
// actually deletes them. This is that something: a sweep that runs on an
// interval in the API process and, per account, removes what that account's own
// retention settings say should be gone.
//
// It reads each user's stored preference rather than a global policy, so
// changing the setting changes the behaviour on the next sweep — and a sweep is
// also run immediately when the setting is changed, so the effect is visible
// without waiting.

import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { db, schema } from "../db";

export interface SweepResult {
  conversationsDeleted: number;
  assetsDeleted: number;
  accountsChecked: number;
}

function cutoff(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

/** Retention numbers as stored on one account, defaults included. */
function retentionOf(row: {
  conversationPrefs: Record<string, unknown>;
  imagePrefs: Record<string, unknown>;
  filePrefs: Record<string, unknown>;
}): { conversations: number; images: number; files: number } {
  const num = (v: unknown) => (typeof v === "number" && v > 0 ? v : 0);
  return {
    conversations: num(row.conversationPrefs?.retentionDays),
    images: num(row.imagePrefs?.retentionDays),
    files: num(row.filePrefs?.retentionDays),
  };
}

/**
 * Apply one account's retention settings now.
 *
 * Pinned conversations are exempt. Someone who pinned a thread has said it
 * matters, and silently deleting it on day 31 would be the single worst thing
 * this function could do.
 */
export async function sweepUser(userId: string): Promise<SweepResult> {
  const row = await db.query.userSettings.findFirst({
    where: eq(schema.userSettings.userId, userId),
    columns: { conversationPrefs: true, imagePrefs: true, filePrefs: true },
  });

  if (!row) {
    return { conversationsDeleted: 0, assetsDeleted: 0, accountsChecked: 1 };
  }

  const keep = retentionOf({
    conversationPrefs: row.conversationPrefs ?? {},
    imagePrefs: row.imagePrefs ?? {},
    filePrefs: row.filePrefs ?? {},
  });

  let conversationsDeleted = 0;
  let assetsDeleted = 0;

  if (keep.conversations > 0) {
    const deleted = await db
      .delete(schema.conversations)
      .where(
        and(
          eq(schema.conversations.userId, userId),
          eq(schema.conversations.pinned, false),
          lt(schema.conversations.updatedAt, cutoff(keep.conversations))
        )
      )
      .returning({ id: schema.conversations.id });
    conversationsDeleted = deleted.length;
  }

  // Images and other files share one table and are told apart by `type`, so the
  // two retention periods are applied as two statements rather than one.
  for (const [days, types] of [
    [keep.images, ["image"]],
    [keep.files, ["document", "video", "code", "other"]],
  ] as const) {
    if (days <= 0) continue;
    const deleted = await db
      .delete(schema.libraryAssets)
      .where(
        and(
          eq(schema.libraryAssets.userId, userId),
          inArray(schema.libraryAssets.type, [...types]),
          lt(schema.libraryAssets.createdAt, cutoff(days))
        )
      )
      .returning({ id: schema.libraryAssets.id });
    assetsDeleted += deleted.length;
  }

  return { conversationsDeleted, assetsDeleted, accountsChecked: 1 };
}

/**
 * Sweep every account that has a retention period set.
 *
 * Only accounts with a non-zero retention are visited — the default is "keep
 * indefinitely", and the overwhelming majority of rows will never match.
 */
export async function sweepAll(): Promise<SweepResult> {
  const rows = await db
    .select({ userId: schema.userSettings.userId })
    .from(schema.userSettings)
    .where(
      sql`
        coalesce((${schema.userSettings.conversationPrefs} ->> 'retentionDays')::int, 0) > 0
        OR coalesce((${schema.userSettings.imagePrefs} ->> 'retentionDays')::int, 0) > 0
        OR coalesce((${schema.userSettings.filePrefs} ->> 'retentionDays')::int, 0) > 0
      `
    );

  const total: SweepResult = {
    conversationsDeleted: 0,
    assetsDeleted: 0,
    accountsChecked: 0,
  };

  for (const { userId } of rows) {
    try {
      const result = await sweepUser(userId);
      total.conversationsDeleted += result.conversationsDeleted;
      total.assetsDeleted += result.assetsDeleted;
      total.accountsChecked += 1;
    } catch (err) {
      // One account's failure must not stop the rest of the sweep.
      console.error(
        `Retention sweep failed for ${userId}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  return total;
}

const SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1000; // four times a day

let timer: NodeJS.Timeout | null = null;

/** Starts the periodic sweep. Safe to call once at boot. */
export function startRetentionSweeper(): void {
  if (timer) return;

  const run = () => {
    sweepAll()
      .then((r) => {
        if (r.conversationsDeleted || r.assetsDeleted) {
          console.log(
            `Retention sweep: removed ${r.conversationsDeleted} conversations and ${r.assetsDeleted} files across ${r.accountsChecked} accounts`
          );
        }
      })
      .catch((err) =>
        console.error(
          "Retention sweep failed:",
          err instanceof Error ? err.message : err
        )
      );
  };

  // Not at boot: a deploy loop would otherwise run a full sweep on every
  // restart. First pass is one interval in.
  timer = setInterval(run, SWEEP_INTERVAL_MS);
  timer.unref?.();
}

export function stopRetentionSweeper(): void {
  if (timer) clearInterval(timer);
  timer = null;
}

/** Fire-and-forget sweep for one account, used right after a settings change. */
export function sweepUserInBackground(userId: string): void {
  sweepUser(userId).catch((err) =>
    console.error(
      "Immediate retention sweep failed:",
      err instanceof Error ? err.message : err
    )
  );
}
