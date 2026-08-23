import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { desc, eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db, schema } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const conversations = await db.query.conversations.findMany({
    where: eq(schema.conversations.userId, userId),
    orderBy: [desc(schema.conversations.updatedAt)],
    columns: { id: true, title: true, updatedAt: true, projectId: true },
  });

  return NextResponse.json(conversations);
}
