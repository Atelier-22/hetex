import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db, schema } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let settings = await db.query.userSettings.findFirst({
    where: eq(schema.userSettings.userId, userId),
  });

  if (!settings) {
    const [created] = await db
      .insert(schema.userSettings)
      .values({ userId })
      .returning();
    settings = created;
  }

  return NextResponse.json(settings);
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { theme, assistantName, responseStyle, memoryEnabled, enterToSend } = body;

  const existing = await db.query.userSettings.findFirst({
    where: eq(schema.userSettings.userId, userId),
  });

  const patch = {
    ...(theme && { theme }),
    ...(assistantName && { assistantName }),
    ...(responseStyle && { responseStyle }),
    ...(typeof memoryEnabled === "boolean" && { memoryEnabled }),
    ...(typeof enterToSend === "boolean" && { enterToSend }),
    updatedAt: new Date(),
  };

  let updated;
  if (existing) {
    [updated] = await db
      .update(schema.userSettings)
      .set(patch)
      .where(eq(schema.userSettings.userId, userId))
      .returning();
  } else {
    [updated] = await db
      .insert(schema.userSettings)
      .values({ userId, ...patch })
      .returning();
  }

  return NextResponse.json(updated);
}
