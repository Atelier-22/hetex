import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import { signToken } from "../auth/jwt";
import { requireAuth, asyncHandler } from "../auth/middleware";

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  displayName: z.string().min(1).max(80).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

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

    res.status(201).json({
      token: signToken({ sub: user.id, email: user.email }),
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

    res.json({
      token: signToken({ sub: user.id, email: user.email }),
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
