import { Router } from "express";
import { requireAuth, asyncHandler } from "../auth/middleware";
import {
  listSessions,
  revokeSession,
  revokeOtherSessions,
} from "../auth/sessions";

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
