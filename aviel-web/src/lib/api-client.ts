"use client";

import { getSession } from "next-auth/react";
import { API_BASE_URL, toApiError } from "./api";

/**
 * Browser-side fetch against the Aviel API.
 *
 * The bearer token lives inside the NextAuth session rather than in
 * localStorage — a script injected into the page can read localStorage, but
 * not an httpOnly session cookie. `getSession()` reads it back out through
 * NextAuth's own endpoint.
 */
async function authHeaders(): Promise<Record<string, string>> {
  const session = await getSession();
  const token = session?.accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
      ...init.headers,
    },
  });

  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/**
 * Same as `apiFetch` but returns the raw Response so the caller can read a
 * Server-Sent Events body. Asking for `text/event-stream` is what tells the
 * backend to stream rather than reply with one JSON blob.
 */
export async function apiStream(
  path: string,
  body: unknown,
  signal?: AbortSignal
): Promise<Response> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...(await authHeaders()),
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) throw await toApiError(res);
  return res;
}
