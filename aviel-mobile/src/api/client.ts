import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

/**
 * Base URL of the Aviel API.
 *
 * Resolution order:
 *   1. EXPO_PUBLIC_API_URL           — set in .env or the EAS build profile
 *   2. app.json -> expo.extra.apiUrl — committed default
 *   3. localhost                     — last resort, only useful on a simulator
 *
 * A phone cannot reach "localhost" — that means the phone itself. When running
 * the backend on your own machine, set EXPO_PUBLIC_API_URL to your computer's
 * LAN address (e.g. http://192.168.1.42:4000). Once the backend is deployed,
 * point it at the Render URL and the LAN requirement disappears entirely.
 */
const extra = (Constants.expoConfig?.extra ?? {}) as { apiUrl?: string };

export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL ??
  extra.apiUrl ??
  "http://localhost:4000"
).replace(/\/$/, "");

const TOKEN_KEY = "aviel_mobile_token";

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getToken();

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    // fetch only rejects on a transport failure, and its message ("Network
    // request failed") tells the user nothing actionable.
    throw new Error(
      `Couldn't reach the Aviel server at ${API_BASE_URL}. Check your connection and that the API is running.`
    );
  }

  const data = await res.json().catch(() => ({} as Record<string, unknown>));

  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error ?? `Request failed (${res.status})`
    );
  }

  return data as T;
}

export interface AuthResponse {
  token: string;
  user: { id: string; email: string; displayName: string | null; role: string };
}

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export const api = {
  register: (email: string, password: string, displayName?: string) =>
    request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, displayName }),
    }),

  login: (email: string, password: string) =>
    request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  me: () =>
    request<{
      id: string;
      email: string;
      displayName: string | null;
      role: string;
    }>("/auth/me"),

  // The backend streams only when the request asks for text/event-stream.
  // This client doesn't, so it gets the complete reply as one JSON object.
  sendMessage: (message: string, conversationId?: string) =>
    request<{ conversationId: string; title: string; reply: string }>("/chat", {
      method: "POST",
      body: JSON.stringify({ message, conversationId }),
    }),

  conversations: () => request<ConversationSummary[]>("/conversations"),
};
