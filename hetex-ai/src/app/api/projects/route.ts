import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { desc, eq, sql } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db, schema } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projects = await db.query.projects.findMany({
    where: eq(schema.projects.userId, userId),
    orderBy: [desc(schema.projects.updatedAt)],
    with: { conversations: { columns: { id: true } } },
  });

  const withCounts = projects.map((p) => ({
    ...p,
    _count: { conversations: p.conversations.length },
  }));

  return NextResponse.json(withCounts);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, instructions } = await req.json();
  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "Project name is required" }, { status: 400 });
  }

  const [project] = await db
    .insert(schema.projects)
    .values({ userId, name, instructions })
    .returning();

  return NextResponse.json(project, { status: 201 });
}
