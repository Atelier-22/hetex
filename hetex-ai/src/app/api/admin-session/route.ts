import { cookies } from "next/headers";
import { API_BASE_URL } from "@/lib/api";
import { ADMIN_COOKIE } from "@/lib/admin-cookie";

/**
 * The admin area's own sign-in, deliberately separate from the product's.
 *
 * It does not touch NextAuth or the chat app's session. Signing into Hetex does
 * not sign you into this, and a stale chat session cannot break it — which is
 * exactly what went wrong when the dashboard lived inside the app.
 *
 * The token is kept in an httpOnly cookie, so no script on the page can read it.
 */


export async function POST(request: Request) {
  const { email, password } = await request.json().catch(() => ({}));

  if (!email || !password) {
    return Response.json(
      { error: "Enter your email and password" },
      { status: 400 }
    );
  }

  let token: string | undefined;
  try {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) token = (await res.json()).token;
  } catch {
    return Response.json(
      { error: "Couldn't reach the server. Try again." },
      { status: 502 }
    );
  }

  // Same message whether the credentials were wrong or the account simply is
  // not an admin. Telling them apart would let someone probe for admin emails.
  const denied = Response.json(
    { error: "Those details don't give access to the dashboard." },
    { status: 401 }
  );

  if (!token) return denied;

  const check = await fetch(`${API_BASE_URL}/admin/me`, {
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => null);

  if (!check?.ok) return denied;
  const { isAdmin } = await check.json();
  if (!isAdmin) return denied;

  cookies().set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12, // Half a day — an admin session should not linger.
  });

  return Response.json({ ok: true });
}

export async function DELETE() {
  cookies().delete(ADMIN_COOKIE);
  return Response.json({ ok: true });
}
