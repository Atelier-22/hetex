import jwt from "jsonwebtoken";
import { env } from "../env";

export interface TokenPayload {
  sub: string; // user id
  email: string;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (typeof decoded === "string") return null;
    if (typeof decoded.sub !== "string") return null;
    return { sub: decoded.sub, email: String(decoded.email ?? "") };
  } catch {
    // Expired, malformed, or signed with a different secret — all mean
    // "not authenticated" to the caller. The distinction isn't useful here
    // and leaking it would help an attacker probe the token format.
    return null;
  }
}
