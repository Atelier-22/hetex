import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { and, asc, eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { ChatWindow } from "@/components/chat/chat-window";

export default async function ChatPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return notFound();

  const conversation = await db.query.conversations.findFirst({
    where: and(
      eq(schema.conversations.id, params.id),
      eq(schema.conversations.userId, userId)
    ),
    with: { messages: { orderBy: [asc(schema.messages.createdAt)] } },
  });

  if (!conversation) return notFound();

  return (
    <ChatWindow
      conversationId={conversation.id}
      initialMessages={conversation.messages.map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
      }))}
    />
  );
}
