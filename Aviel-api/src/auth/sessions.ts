import type { Request } from "express";
import { and, eq, isNull, ne } from "drizzle-orm";
import { db, schema } from "../db";

/**
 * Client IP, honouring the proxy Render terminates TLS at.
 *
 * `trust proxy` is set on the app, so express already resolves req.ip from
 * X-Forwarded-For rather than reporting the proxy's own address.
 */
function clientIp(req: Request): string | null {
  return req.ip ?? null;
}

export async function createSession(userId: string, req: Request) {
  const [session] = await db
    .insert(schema.userSessions)
    .values({
      userId,
      ipAddress: clientIp(req),
      userAgent: (req.headers["user-agent"] ?? "").slice(0, 400) || null,
    })
    .returning();
  return session;
}

/**
 * Whether a session is still usable, plus a throttled last-active touch.
 *
 * Called on every authenticated request, so the write is rate-limited: without
 * the interval check a busy client would issue an UPDATE per request purely to
 * move a timestamp a few milliseconds.
 */
const TOUCH_INTERVAL_MS = 60_000;

export async function validateSession(sessionId: string): Promise<boolean> {
  const session = await db.query.userSessions.findFirst({
    where: eq(schema.userSessions.id, sessionId),
    columns: { id: true, revokedAt: true, lastActiveAt: true },
  });

  if (!session || session.revokedAt) return false;

  const age = Date.now() - new Date(session.lastActiveAt).getTime();
  if (age > TOUCH_INTERVAL_MS) {
    await db
      .update(schema.userSessions)
      .set({ lastActiveAt: new Date() })
      .where(eq(schema.userSessions.id, sessionId));
  }

  return true;
}

export async function listSessions(userId: string) {
  return db.query.userSessions.findMany({
    where: and(
      eq(schema.userSessions.userId, userId),
      isNull(schema.userSessions.revokedAt)
    ),
    orderBy: (s, { desc }) => [desc(s.lastActiveAt)],
    columns: {
      id: true,
      ipAddress: true,
      userAgent: true,
      lastActiveAt: true,
      createdAt: true,
    },
  });
}

export async function revokeSession(userId: string, sessionId: string) {
  const revoked = await db
    .update(schema.userSessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(schema.userSessions.id, sessionId),
        eq(schema.userSessions.userId, userId),
        isNull(schema.userSessions.revokedAt)
      )
    )
    .returning({ id: schema.userSessions.id });
  return revoked.length > 0;
}

/** Revokes everything except the caller's own session. */
export async function revokeOtherSessions(userId: string, keepSessionId: string) {
  const revoked = await db
    .update(schema.userSessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(schema.userSessions.userId, userId),
        ne(schema.userSessions.id, keepSessionId),
        isNull(schema.userSessions.revokedAt)
      )
    )
    .returning({ id: schema.userSessions.id });
  return revoked.length;
}
