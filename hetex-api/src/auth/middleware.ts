import type { Request, Response, NextFunction, RequestHandler } from "express";
import { verifyToken } from "./jwt";
import { validateSession } from "./sessions";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
      sessionId?: string;
    }
  }
}

/**
 * Reads a bearer token from the Authorization header and attaches the user id
 * to the request. Both clients authenticate the same way — the web frontend
 * holds this token inside its NextAuth session, the mobile app in
 * expo-secure-store — so there is one auth path to reason about, not two.
 */
export const requireAuth: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const payload = verifyToken(header.slice("Bearer ".length).trim());

  if (!payload) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  req.userId = payload.sub;
  req.userEmail = payload.email;
  req.sessionId = payload.sid;

  // Tokens issued before sessions existed carry no sid. Rejecting them would
  // log everyone out on deploy; they simply cannot be revoked until they expire.
  if (!payload.sid) {
    next();
    return;
  }

  validateSession(payload.sid)
    .then((valid) => {
      if (!valid) {
        res.status(401).json({ error: "This session has been signed out" });
        return;
      }
      next();
    })
    .catch(next);
};

/**
 * Express 4 does not forward rejected promises from async handlers to the
 * error middleware, so an unhandled rejection would hang the request until it
 * times out. Every async route below is wrapped in this.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
