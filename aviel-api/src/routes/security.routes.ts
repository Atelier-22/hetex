import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import { requireAuth, asyncHandler } from "../auth/middleware";
import {
  listSessions,
  revokeSession,
  revokeOtherSessions,
} from "../auth/sessions";
import {
  generateRecoveryCodes,
  generateSecret,
  otpauthUri,
  verifyCode,
} from "../auth/totp";

export const securityRouter = Router();

securityRouter.use(requireAuth);

/**
 * Devices signed in to this account.
 *
 * `current` marks the caller's own session so the UI can label it and refuse to
 * offer a "sign out" button that would log you out of the screen you are on.
 */
securityRouter.get(
  "/sessions",
  asyncHandler(async (req, res) => {
    const sessions = await listSessions(req.userId!);

    res.json(
      sessions.map((s) => ({
        id: s.id,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
        lastActiveAt: s.lastActiveAt,
        createdAt: s.createdAt,
        current: s.id === req.sessionId,
      }))
    );
  })
);

securityRouter.delete(
  "/sessions/:id",
  asyncHandler(async (req, res) => {
    if (req.params.id === req.sessionId) {
      res.status(400).json({
        error: "This is your current session — use log out instead.",
      });
      return;
    }

    const ok = await revokeSession(req.userId!, req.params.id);
    if (!ok) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    res.json({ success: true });
  })
);

/** Signs out everywhere except here. */
securityRouter.post(
  "/sessions/revoke-others",
  asyncHandler(async (req, res) => {
    if (!req.sessionId) {
      res.status(400).json({
        error:
          "Your current session predates device tracking. Sign out and back in first.",
      });
      return;
    }

    const count = await revokeOtherSessions(req.userId!, req.sessionId);
    res.json({ success: true, revoked: count });
  })
);

/* -------------------------------------------------------------------------- */
/* Two-factor authentication                                                  */
/* -------------------------------------------------------------------------- */

securityRouter.get(
  "/2fa",
  asyncHandler(async (req, res) => {
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, req.userId!),
      columns: {
        totpEnabled: true,
        totpConfirmedAt: true,
        totpRecoveryCodes: true,
      },
    });

    res.json({
      enabled: user?.totpEnabled ?? false,
      confirmedAt: user?.totpConfirmedAt ?? null,
      recoveryCodesRemaining: user?.totpRecoveryCodes.length ?? 0,
    });
  })
);

/**
 * Begin enrolment.
 *
 * Writes the secret but leaves `totpEnabled` false — an enrolment that is
 * started and abandoned must not lock anybody out at the next sign-in. Only
 * /confirm, which proves the app is generating matching codes, turns it on.
 */
securityRouter.post(
  "/2fa/start",
  asyncHandler(async (req, res) => {
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, req.userId!),
      columns: { email: true, totpEnabled: true },
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (user.totpEnabled) {
      res.status(409).json({
        error: "Two-factor authentication is already on. Turn it off first to re-enrol.",
      });
      return;
    }

    const secret = generateSecret();

    await db
      .update(schema.users)
      .set({ totpSecret: secret, updatedAt: new Date() })
      .where(eq(schema.users.id, req.userId!));

    res.json({
      secret,
      uri: otpauthUri({ secret, account: user.email }),
      // No QR image is generated: that would need an image library, and every
      // authenticator app accepts a typed secret. The URI is given so a client
      // that can render a QR code has what it needs.
      digits: 6,
      period: 30,
    });
  })
);

const confirmSchema = z.object({ code: z.string().min(6).max(10) });

securityRouter.post(
  "/2fa/confirm",
  asyncHandler(async (req, res) => {
    const parsed = confirmSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Enter the 6-digit code from your app" });
      return;
    }

    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, req.userId!),
      columns: { totpSecret: true, totpEnabled: true },
    });

    if (!user?.totpSecret) {
      res.status(409).json({ error: "Start the setup again — no secret is pending." });
      return;
    }

    if (!verifyCode(user.totpSecret, parsed.data.code)) {
      res.status(401).json({
        error: "That code isn't right. Check your phone's clock and try the next one.",
      });
      return;
    }

    // Shown once, here, and stored only as hashes.
    const recoveryCodes = generateRecoveryCodes();
    const hashes = await Promise.all(
      recoveryCodes.map((c) => bcrypt.hash(c.toLowerCase(), 10))
    );

    await db
      .update(schema.users)
      .set({
        totpEnabled: true,
        totpConfirmedAt: new Date(),
        totpRecoveryCodes: hashes,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, req.userId!));

    res.json({ enabled: true, recoveryCodes });
  })
);

const disableSchema = z.object({
  password: z.string().min(1),
  code: z.string().max(40).optional(),
});

/**
 * Turn 2FA off.
 *
 * Requires the password, not just a live session. Someone who walks up to an
 * unlocked laptop should not be able to remove the second factor and keep the
 * account.
 */
securityRouter.post(
  "/2fa/disable",
  asyncHandler(async (req, res) => {
    const parsed = disableSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Your password is required" });
      return;
    }

    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, req.userId!),
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (!(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
      res.status(401).json({ error: "Password is incorrect" });
      return;
    }

    if (
      user.totpEnabled &&
      user.totpSecret &&
      !(parsed.data.code && verifyCode(user.totpSecret, parsed.data.code))
    ) {
      res.status(401).json({
        error: "Enter a current code from your authenticator app to turn this off.",
        requiresTotp: true,
      });
      return;
    }

    await db
      .update(schema.users)
      .set({
        totpEnabled: false,
        totpSecret: null,
        totpConfirmedAt: null,
        totpRecoveryCodes: [],
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, req.userId!));

    res.json({ enabled: false });
  })
);
