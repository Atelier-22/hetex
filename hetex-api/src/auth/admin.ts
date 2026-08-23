import crypto from "crypto";
import type { RequestHandler } from "express";
import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import { env } from "../env";
import { signToken, verifyToken } from "./jwt";

/**
 * Two ways to be an admin.
 *
 * 1. ADMIN_EMAIL + ADMIN_PASSWORD — a standalone owner login that needs no
 *    Hetex account. This is the simple path: set two environment variables and
 *    sign in. They live in the environment and not in the code because this
 *    repository is public, and a credential committed to it would be a
 *    backdoor anyone could read.
 *
 * 2. ADMIN_EMAILS — existing Hetex accounts promoted to admin, for when more
 *    than one person needs access.
 */

const adminEmails = new Set(
  env.ADMIN_EMAILS.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
);

export function isAdminEmail(email: string): boolean {
  return adminEmails.has(email.toLowerCase());
}

export const OWNER_SUBJECT = "__owner__";

export function ownerLoginConfigured(): boolean {
  return Boolean(env.ADMIN_EMAIL && env.ADMIN_PASSWORD);
}

/** Constant-time compare, so a wrong guess can't be timed character by character. */
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export function checkOwnerLogin(email: string, password: string): boolean {
  if (!ownerLoginConfigured()) return false;
  return (
    safeEqual(email.trim().toLowerCase(), env.ADMIN_EMAIL!.trim().toLowerCase()) &&
    safeEqual(password, env.ADMIN_PASSWORD!)
  );
}

export function issueOwnerToken(): string {
  return signToken({ sub: OWNER_SUBJECT, email: env.ADMIN_EMAIL!, adm: true });
}

/**
 * Guards every admin route.
 *
 * Deliberately not layered on requireAuth: the owner login has no user record
 * to look up, so the two paths are resolved here in one place.
 */
export const requireAdmin: RequestHandler = (req, res, next) => {
  const header = req.headers.authorization;

  // 404 rather than 401/403 throughout: a non-admin has no business learning
  // that an admin surface exists at this path.
  const hide = () => res.status(404).json({ error: "Not found" });

  if (!header?.startsWith("Bearer ")) return hide();

  const payload = verifyToken(header.slice("Bearer ".length).trim());
  if (!payload) return hide();

  // Path 1: the standalone owner token.
  if (payload.adm && payload.sub === OWNER_SUBJECT) {
    req.userId = OWNER_SUBJECT;
    req.userEmail = payload.email;
    next();
    return;
  }

  // Path 2: a Hetex account that is an admin.
  db.query.users
    .findFirst({
      where: eq(schema.users.id, payload.sub),
      columns: { id: true, email: true, role: true },
    })
    .then((user) => {
      if (!user) return hide();
      if (user.role !== "admin" && !isAdminEmail(user.email)) return hide();

      req.userId = user.id;
      req.userEmail = user.email;
      next();
    })
    .catch(next);
};
