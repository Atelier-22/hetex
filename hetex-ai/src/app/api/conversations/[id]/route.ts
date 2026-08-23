import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { and, asc, eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db, schema } from "@/lib/db";

async function requireUserId() {
  const session = await getServerSession(authOptions);
  return (session?.user as { id?: string } | undefined)?.id;
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const conversation = await db.query.conversations.findFirst({
    where: and(
      eq(schema.conversations.id, params.id),
      eq(schema.conversations.userId, userId)
    ),
    with: { messages: { orderBy: [asc(schema.messages.createdAt)] } },
  });

  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(conversation);
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { title } = await req.json();
  const updated = await db
    .update(schema.conversations)
    .set({ title })
    .where(
      and(
        eq(schema.conversations.id, params.id),
        eq(schema.conversations.userId, userId)
      )
    )
    .returning();

  if (updated.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await db
    .delete(schema.conversations)
    .where(
      and(
        eq(schema.conversations.id, params.id),
        eq(schema.conversations.userId, userId)
      )
    );
  return NextResponse.json({ success: true });
}
