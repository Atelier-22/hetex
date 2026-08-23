/**
 * Base URL of the Hetex API (the Express service deployed on Render).
 *
 * NEXT_PUBLIC_ is required: this value is read in the browser, so it has to be
 * inlined at build time. On Vercel it must be set before the build runs, not
 * only at runtime.
 */
export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"
).replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Pulls the backend's error message out of a failed response. */
export async function toApiError(res: Response): Promise<ApiError> {
  const data = await res.json().catch(() => ({}) as { error?: string });
  return new ApiError(data.error ?? `Request failed (${res.status})`, res.status);
}
