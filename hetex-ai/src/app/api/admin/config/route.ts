import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { API_BASE_URL } from "@/lib/api";
import { ADMIN_COOKIE } from "@/lib/admin-cookie";

/**
 * Server-side proxy for platform configuration.
 *
 * The admin token lives in an httpOnly cookie so a script on the page cannot
 * read it. That also means the browser cannot call the API directly with it —
 * this route is the only path, and it exists so the token stays where it is.
 *
 * It forwards, and nothing more: every decision about what an administrator may
 * change is made by the API, which validates the body and refuses flags that
 * would enable something no provider implements.
 */
async function forward(method: "GET" | "PATCH", body?: string) {
  const token = cookies().get(ADMIN_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    const res = await fetch(`${API_BASE_URL}/admin/config`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body } : {}),
      cache: "no-store",
    });

    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return NextResponse.json(
      { error: "The Hetex API could not be reached." },
      { status: 502 }
    );
  }
}

export async function GET() {
  return forward("GET");
}

export async function PATCH(request: Request) {
  return forward("PATCH", await request.text());
}
