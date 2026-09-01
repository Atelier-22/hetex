import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { asc, desc, eq } from "drizzle-orm";
import { db, schema } from "../db";
import { requireAuth, asyncHandler } from "../auth/middleware";
import { signToken } from "../auth/jwt";

export const accountRouter = Router();

accountRouter.use(requireAuth);

const profileSchema = z.object({
  displayName: z.string().min(1).max(80),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

/** Update the display name. */
accountRouter.patch(
  "/profile",
  asyncHandler(async (req, res) => {
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
      return;
    }

    const [user] = await db
      .update(schema.users)
      .set({ displayName: parsed.data.displayName.trim(), updatedAt: new Date() })
      .where(eq(schema.users.id, req.userId!))
      .returning();

    res.json({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    });
  })
);

/** Change password. Requires the current one — a stolen session shouldn't be
 *  enough to lock the real owner out of their account. */
accountRouter.patch(
  "/password",
  asyncHandler(async (req, res) => {
    const parsed = passwordSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
      return;
    }

    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, req.userId!),
    });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const valid = await bcrypt.compare(
      parsed.data.currentPassword,
      user.passwordHash
    );
    if (!valid) {
      res.status(401).json({ error: "Current password is incorrect" });
      return;
    }

    if (parsed.data.currentPassword === parsed.data.newPassword) {
      res
        .status(400)
        .json({ error: "The new password must be different from the current one" });
      return;
    }

    await db
      .update(schema.users)
      .set({
        passwordHash: await bcrypt.hash(parsed.data.newPassword, 12),
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, user.id));

    // Tokens are stateless, so existing ones stay valid until they expire.
    // Issuing a fresh one at least keeps the current session working after the
    // change, rather than silently drifting out of sync.
    res.json({
      success: true,
      token: signToken({ sub: user.id, email: user.email }),
    });
  })
);

/** Everything this account holds, as one JSON document. */
accountRouter.get(
  "/export",
  asyncHandler(async (req, res) => {
    const userId = req.userId!;

    const [user, settings, conversations, projects, memory, library, usage, feedback] =
      await Promise.all([
        db.query.users.findFirst({ where: eq(schema.users.id, userId) }),
        db.query.userSettings.findFirst({
          where: eq(schema.userSettings.userId, userId),
        }),
        db.query.conversations.findMany({
          where: eq(schema.conversations.userId, userId),
          orderBy: [desc(schema.conversations.updatedAt)],
          with: { messages: { orderBy: [asc(schema.messages.createdAt)] } },
        }),
        db.query.projects.findMany({ where: eq(schema.projects.userId, userId) }),
        db.query.userMemory.findMany({
          where: eq(schema.userMemory.userId, userId),
        }),
        db.query.libraryAssets.findMany({
          where: eq(schema.libraryAssets.userId, userId),
        }),
        db.query.usageRecords.findMany({
          where: eq(schema.usageRecords.userId, userId),
        }),
        db.query.messageFeedback.findMany({
          where: eq(schema.messageFeedback.userId, userId),
        }),
      ]);

    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Aviel-export-${new Date().toISOString().slice(0, 10)}.json"`
    );
    res.json({
      exportedAt: new Date().toISOString(),
      account: user && {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        createdAt: user.createdAt,
      },
      settings,
      conversations,
      projects,
      memory,
      library,
      usage,
      feedback,
    });
  })
);

/** Delete every conversation, project, memory entry, and asset — but keep the
 *  account itself. */
accountRouter.post(
  "/erase-data",
  asyncHandler(async (req, res) => {
    const userId = req.userId!;

    // Messages, and library assets tied to a conversation, go with the
    // conversations via ON DELETE CASCADE.
    await db
      .delete(schema.conversations)
      .where(eq(schema.conversations.userId, userId));
    await db.delete(schema.projects).where(eq(schema.projects.userId, userId));
    await db.delete(schema.userMemory).where(eq(schema.userMemory.userId, userId));
    await db
      .delete(schema.libraryAssets)
      .where(eq(schema.libraryAssets.userId, userId));
    await db
      .delete(schema.messageFeedback)
      .where(eq(schema.messageFeedback.userId, userId));
    await db
      .delete(schema.usageRecords)
      .where(eq(schema.usageRecords.userId, userId));

    res.json({ success: true });
  })
);

/** Delete the account and everything attached to it. Irreversible. */
accountRouter.delete(
  "/",
  asyncHandler(async (req, res) => {
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, req.userId!),
    });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Deleting an account is irreversible, so it takes more than possession of
    // a logged-in tab.
    if (!(await bcrypt.compare(password, user.passwordHash))) {
      res.status(401).json({ error: "Password is incorrect" });
      return;
    }

    // Every other table references users.id with ON DELETE CASCADE.
    await db.delete(schema.users).where(eq(schema.users.id, user.id));

    res.json({ success: true });
  })
);

/** What this account is storing, for the Storage panel. */
accountRouter.get(
  "/storage",
  asyncHandler(async (req, res) => {
    const userId = req.userId!;

    const [conversations, messages, assets, memory, projects] = await Promise.all([
      db.query.conversations.findMany({
        where: eq(schema.conversations.userId, userId),
        columns: { id: true },
      }),
      db.query.messages.findMany({ columns: { id: true, content: true, conversationId: true } }),
      db.query.libraryAssets.findMany({
        where: eq(schema.libraryAssets.userId, userId),
        columns: { id: true, url: true },
      }),
      db.query.userMemory.findMany({
        where: eq(schema.userMemory.userId, userId),
        columns: { id: true },
      }),
      db.query.projects.findMany({
        where: eq(schema.projects.userId, userId),
        columns: { id: true },
      }),
    ]);

    const ownedConversationIds = new Set(conversations.map((c) => c.id));
    const ownMessages = messages.filter((m) =>
      ownedConversationIds.has(m.conversationId)
    );

    const messageBytes = ownMessages.reduce(
      (sum, m) => sum + Buffer.byteLength(m.content, "utf8"),
      0
    );
    const assetBytes = assets.reduce(
      (sum, a) => sum + Buffer.byteLength(a.url ?? "", "utf8"),
      0
    );

    res.json({
      conversations: conversations.length,
      messages: ownMessages.length,
      projects: projects.length,
      memoryEntries: memory.length,
      assets: assets.length,
      messageBytes,
      assetBytes,
      totalBytes: messageBytes + assetBytes,
    });
  })
);
