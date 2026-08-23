import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { desc, eq, and } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db, schema } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entries = await db.query.userMemory.findMany({
    where: eq(schema.userMemory.userId, userId),
    orderBy: [desc(schema.userMemory.createdAt)],
  });

  return NextResponse.json(entries);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { content } = await req.json();
  if (!content || typeof content !== "string" || !content.trim()) {
    return NextResponse.json({ error: "Memory content is required" }, { status: 400 });
  }

  const [entry] = await db
    .insert(schema.userMemory)
    .values({ userId, content: content.trim(), source: "manual" })
    .returning();

  return NextResponse.json(entry, { status: 201 });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "Memory id is required" }, { status: 400 });

  await db
    .delete(schema.userMemory)
    .where(and(eq(schema.userMemory.id, id), eq(schema.userMemory.userId, userId)));

  return NextResponse.json({ success: true });
}
