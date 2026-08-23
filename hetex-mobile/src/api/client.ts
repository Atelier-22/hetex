

import * as SecureStore from "expo-secure-store";

export const API_BASE_URL = "http://10.180.201.18:3000";

const TOKEN_KEY = "hetex_mobile_token";

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

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error ?? `Request failed (${res.status})`);
  }

  return data as T;
}

export interface AuthResponse {
  token: string;
  user: { id: string; email: string; displayName: string | null; role: string };
}

export const api = {
  register: (email: string, password: string, displayName?: string) =>
    request<AuthResponse>("/api/mobile/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, displayName }),
    }),

  login: (email: string, password: string) =>
    request<AuthResponse>("/api/mobile/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  me: () =>
    request<{ id: string; email: string; displayName: string | null; role: string }>(
      "/api/mobile/auth/me"
    ),

  sendMessage: (message: string, conversationId?: string) =>
    request<{ conversationId: string; title: string; reply: string }>("/api/mobile/chat", {
      method: "POST",
      body: JSON.stringify({ message, conversationId }),
    }),
};
