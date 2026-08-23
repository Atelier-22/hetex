import jwt from "jsonwebtoken";
import { env } from "../env";

export interface TokenPayload {
  sub: string; // user id
  email: string;
  /**
   * Session id. A JWT is otherwise self-contained and valid until it expires,
   * with no server-side handle to pull — this is what lets a session be
   * revoked from the Security screen.
   *
   * Optional so tokens issued before sessions existed keep working until they
   * expire, rather than logging everyone out on deploy.
   */
  sid?: string;
  /** Set on the standalone owner token, which has no user record behind it. */
  adm?: boolean;
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
    return {
      sub: decoded.sub,
      email: String(decoded.email ?? ""),
      sid: typeof decoded.sid === "string" ? decoded.sid : undefined,
      adm: decoded.adm === true,
    };
  } catch {
    // Expired, malformed, or signed with a different secret — all mean "not
    // authenticated" to the caller. The distinction isn't useful here and
    // leaking it would help an attacker probe the token format.
    return null;
  }
}
