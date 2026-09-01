import "server-only";
import { cookies } from "next/headers";
import { API_BASE_URL } from "./api";
import { ADMIN_COOKIE } from "./admin-cookie";

/**
 * Fetches from the API using the admin cookie.
 *
 * Returns null when there is no cookie or the request fails, so callers can
 * simply redirect to the admin sign-in.
 */
export async function adminFetch<T>(path: string): Promise<T | null> {
  const token = cookies().get(ADMIN_COOKIE)?.value;
  if (!token) return null;

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
