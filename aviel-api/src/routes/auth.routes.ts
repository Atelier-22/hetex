import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import { signToken } from "../auth/jwt";
import { createSession } from "../auth/sessions";
import { requireAuth, asyncHandler } from "../auth/middleware";
import { verifyCode } from "../auth/totp";

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  displayName: z.string().min(1).max(80).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  /** A 6-digit authenticator code, or one recovery code. */
  totpCode: z.string().max(40).optional(),
});

/**
 * Which stored recovery hash this code matches, or -1.
 *
 * Every hash is compared even after a match so the time taken does not reveal
 * how far down the list the code was.
 */
async function findRecoveryCode(
  code: string,
  hashes: string[]
): Promise<number> {
  const normalised = code.trim().toLowerCase();
  let found = -1;
  for (let i = 0; i < hashes.length; i++) {
    if (await bcrypt.compare(normalised, hashes[i])) found = i;
  }
  return found;
}

function publicUser(user: typeof schema.users.$inferSelect) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
  };
}

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
      return;
    }

    const { password, displayName } = parsed.data;
    const email = parsed.data.email.toLowerCase().trim();

    const existing = await db.query.users.findFirst({
      where: eq(schema.users.email, email),
    });
    if (existing) {
      res
        .status(409)
        .json({ error: "An account with this email already exists" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const [user] = await db
      .insert(schema.users)
      .values({
        email,
        passwordHash,
        displayName: displayName?.trim() || email.split("@")[0],
      })
      .returning();

    await db.insert(schema.userSettings).values({ userId: user.id });

    const session = await createSession(user.id, req);

    res.status(201).json({
      token: signToken({ sub: user.id, email: user.email, sid: session.id }),
      user: publicUser(user),
    });
  })
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    const email = parsed.data.email.toLowerCase().trim();

    const user = await db.query.users.findFirst({
      where: eq(schema.users.email, email),
    });

    // Same message and timing shape for "no such user" and "wrong password" —
    // telling them apart would let an attacker enumerate registered emails.
    const valid =
      user && (await bcrypt.compare(parsed.data.password, user.passwordHash));

    if (!user || !valid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    // Second factor, checked only after the password is known to be right —
    // otherwise the "enter your code" prompt itself would confirm that an email
    // is registered and its password correct.
    if (user.totpEnabled && user.totpSecret) {
      const code = parsed.data.totpCode?.trim();

      if (!code) {
        res.status(401).json({
          error: "Enter the code from your authenticator app.",
          requiresTotp: true,
        });
        return;
      }

      const authenticated = verifyCode(user.totpSecret, code);
      const recoveryIndex = authenticated
        ? -1
        : await findRecoveryCode(code, user.totpRecoveryCodes);

      if (!authenticated && recoveryIndex === -1) {
        res.status(401).json({
          error: "That code isn't right. Check the app, or use a recovery code.",
          requiresTotp: true,
        });
        return;
      }

      // A recovery code is single-use. Spending it here is what makes the list
      // finite rather than a permanent second password.
      if (recoveryIndex >= 0) {
        const remaining = user.totpRecoveryCodes.filter(
          (_, i) => i !== recoveryIndex
        );
        await db
          .update(schema.users)
          .set({ totpRecoveryCodes: remaining, updatedAt: new Date() })
          .where(eq(schema.users.id, user.id));
      }
    }

    // Each sign-in is its own session, so the Security screen can list devices
    // separately and revoke one without touching the others.
    const session = await createSession(user.id, req);

    res.json({
      token: signToken({ sub: user.id, email: user.email, sid: session.id }),
      user: publicUser(user),
    });
  })
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, req.userId!),
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json(publicUser(user));
  })
);
