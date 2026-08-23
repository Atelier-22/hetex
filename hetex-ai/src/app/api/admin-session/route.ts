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

  // One call. The API decides whether these credentials are the owner's, or
  // belong to a Hetex account that has been made an admin.
  let token: string | undefined;
  try {
    const res = await fetch(`${API_BASE_URL}/admin/login`, {
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

  if (!token) {
    return Response.json(
      { error: "Those details don't give access to the dashboard." },
      { status: 401 }
    );
  }

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
