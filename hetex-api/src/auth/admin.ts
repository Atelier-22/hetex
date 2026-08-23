import type { RequestHandler } from "express";
import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import { env } from "../env";

/**
 * Emails that are always admins, regardless of the stored role.
 *
 * This is the bootstrap: the first admin cannot be promoted by an admin because
 * there isn't one yet. Setting ADMIN_EMAILS grants access without hand-editing
 * the database, and the role column still works for anyone promoted later.
 */
const adminEmails = new Set(
  env.ADMIN_EMAILS.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
);

export function isAdminEmail(email: string): boolean {
  return adminEmails.has(email.toLowerCase());
}

export const requireAdmin: RequestHandler = (req, res, next) => {
  // requireAuth runs first and has already established who this is.
  if (!req.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  db.query.users
    .findFirst({
      where: eq(schema.users.id, req.userId),
      columns: { email: true, role: true },
    })
    .then((user) => {
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      if (user.role === "admin" || isAdminEmail(user.email)) {
        next();
        return;
      }

      // 404 rather than 403: a non-admin has no business learning that an
      // admin surface exists here.
      res.status(404).json({ error: "Not found" });
    })
    .catch(next);
};
