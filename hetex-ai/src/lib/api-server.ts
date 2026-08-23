import "server-only";

import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { API_BASE_URL } from "./api";

/**
 * Server-component fetch against the Hetex API, authenticated with the bearer
 * token stored in the current NextAuth session.
 *
 * Returns null when the request fails for any reason — server components have
 * no error boundary to catch a throw here, and every caller wants the same
 * "render not-found" behaviour anyway.
 */
export async function serverApiFetch<T>(path: string): Promise<T | null> {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) return null;

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      // Conversations change on every message; a cached response would show
      // the user a stale thread after they sent something.
      cache: "no-store",
    });

    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
