import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";
import fs from "fs/promises";
import path from "path";
import { authOptions } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { webSearch } from "@/lib/tools/web-search.tool";
import {
  getOrCreateConversation,
  saveMessage,
  maybeTitleConversation,
  recordUsage,
  buildMessageHistory,
  getSystemPrompt,
  getProvider,
} from "@/lib/services/chat.service";

export const runtime = "nodejs";

type Attachment = {
  name: string;
  mediaType: string;
  base64: string; // no data: prefix
};

async function saveAttachmentsToLibrary(
  userId: string,
  conversationId: string,
  prompt: string,
  attachments: Attachment[]
) {
  const uploadDir = path.join(process.cwd(), "public", "uploads", userId);
  await fs.mkdir(uploadDir, { recursive: true });

  for (const att of attachments) {
    const safeName = `${Date.now()}-${att.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const filePath = path.join(uploadDir, safeName);
    await fs.writeFile(filePath, Buffer.from(att.base64, "base64"));

    const isImage = att.mediaType.startsWith("image/");
    await db.insert(schema.libraryAssets).values({
      userId,
      type: isImage ? "image" : "document",
      url: `/uploads/${userId}/${safeName}`,
      prompt,
      conversationId,
    });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const {
    message,
    conversationId,
    projectId,
    attachments = [],
    webSearchEnabled = false,
  }: {
    message: string;
    conversationId?: string;
    projectId?: string;
    attachments?: Attachment[];
    webSearchEnabled?: boolean;
  } = await req.json();

  if (
    (!message || typeof message !== "string" || !message.trim()) &&
    attachments.length === 0
  ) {
    return NextResponse.json({ error: "Message cannot be empty" }, { status: 400 });
  }

  const conversation = await getOrCreateConversation({
    userId,
    conversationId,
    projectId,
  });
  const isFirstMessage = conversation.messages?.length === 0;

  const imageAttachments = attachments.filter((a) => a.mediaType.startsWith("image/"));
  const otherAttachments = attachments.filter((a) => !a.mediaType.startsWith("image/"));

  let storedContent = message || "";
  if (attachments.length > 0) {
    const names = attachments.map((a) => a.name).join(", ");
    storedContent = storedContent
      ? `${storedContent}\n\n[Attached: ${names}]`
      : `[Attached: ${names}]`;
  }
  if (otherAttachments.length > 0) {
    storedContent += `\n\n(Note: only image attachments are analyzed right now — document content isn't read yet.)`;
  }

  await saveMessage(conversation.id, "user", storedContent);
  await recordUsage(userId, "message");

  if (attachments.length > 0) {
    await saveAttachmentsToLibrary(userId, conversation.id, message || "", attachments);
    await recordUsage(userId, "tool_call");
  }

  if (isFirstMessage) {
    await maybeTitleConversation(conversation.id, message || attachments[0]?.name || "New Chat");
  }

  const settings = await db.query.userSettings.findFirst({
    where: eq(schema.userSettings.userId, userId),
  });
  const assistantName = settings?.assistantName ?? "Hetex AI";
  const responseStyle = settings?.responseStyle ?? "balanced";

  let memoryEntries: string[] = [];
  if (settings?.memoryEnabled) {
    const memories = await db.query.userMemory.findMany({
      where: eq(schema.userMemory.userId, userId),
      orderBy: (m, { desc }) => [desc(m.createdAt)],
      limit: 20,
    });
    memoryEntries = memories.map((m) => m.content);
  }

  let webSearchNote = "";
  if (webSearchEnabled) {
    await recordUsage(userId, "tool_call");
    const result = await webSearch(message || "");
    if (!result.available) {
      webSearchNote = `\n\nThe user turned on web search for this message, but no search provider is configured yet. Briefly let them know you're answering from your training knowledge instead of live search results.`;
    }
  }

  const history = await buildMessageHistory(conversation.id);
  // Attach images to the live turn only (not persisted in message history)
  if (imageAttachments.length > 0 && history.length > 0) {
    const last = history[history.length - 1];
    last.images = imageAttachments.map((a) => ({
      mediaType: a.mediaType,
      data: a.base64,
    }));
  }

  const provider = getProvider();

  if (!provider.isConfigured()) {
    return NextResponse.json(
      {
        error:
          "No AI provider is configured. Set ANTHROPIC_API_KEY in your .env file to enable real responses.",
      },
      { status: 503 }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let fullText = "";

      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      send("meta", { conversationId: conversation.id, title: conversation.title });

      try {
        for await (const chunk of provider.streamCompletion(history, {
          systemPrompt:
            getSystemPrompt(assistantName, responseStyle, memoryEntries) + webSearchNote,
        })) {
          if (chunk.type === "text" && chunk.text) {
            fullText += chunk.text;
            send("chunk", { text: chunk.text });
          } else if (chunk.type === "error") {
            send("error", { message: chunk.error });
          }
        }

        if (fullText.trim().length > 0) {
          await saveMessage(conversation.id, "assistant", fullText);
        }

        send("done", {});
      } catch (err) {
        send("error", {
          message: err instanceof Error ? err.message : "Generation failed",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
