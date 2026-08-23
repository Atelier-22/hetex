import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, schema } from "@/lib/db";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { messageId, conversationId, rating } = await req.json();

  if (!messageId || (rating !== "up" && rating !== "down")) {
    return NextResponse.json({ error: "Invalid feedback payload" }, { status: 400 });
  }

  await db.insert(schema.messageFeedback).values({
    userId,
    messageId,
    conversationId,
    rating,
  });

  return NextResponse.json({ success: true });
}
