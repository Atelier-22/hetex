import type { Request, Response, NextFunction, RequestHandler } from "express";
import { verifyToken } from "./jwt";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
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
  next();
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
