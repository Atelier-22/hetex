import { API_BASE_URL } from "./api";

/**
 * Nudges the API awake.
 *
 * The API sleeps after a period of inactivity and takes tens of seconds to
 * start again. Firing this when a sign-in page mounts means the wake-up happens
 * while the person is still typing, so by the time they submit the server is
 * already running.
 *
 * Deliberately fire-and-forget: nothing waits on it and a failure is
 * irrelevant — the real request will wake the service anyway.
 */
export function wakeApi(): void {
  if (typeof window === "undefined") return;

  fetch(`${API_BASE_URL}/health`, {
    // `no-store` so a cached 200 does not defeat the point.
    cache: "no-store",
    keepalive: true,
  }).catch(() => {
    /* the sign-in request will wake it regardless */
  });
}
