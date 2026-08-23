import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db, schema } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const records = await db.query.usageRecords.findMany({
    where: eq(schema.usageRecords.userId, userId),
  });

  const totals: Record<string, number> = {};
  for (const r of records) {
    totals[r.type] = (totals[r.type] ?? 0) + r.amount;
  }

  return NextResponse.json({ totals, plan: "Free" });
}
