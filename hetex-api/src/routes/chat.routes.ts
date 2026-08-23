import { Router } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import { requireAuth, asyncHandler } from "../auth/middleware";
import {
  getOrCreateConversation,
  saveMessage,
  maybeTitleConversation,
  recordUsage,
  buildMessageHistory,
  getSystemPrompt,
  getUserPreferences,
  getProvider,
} from "../services/chat.service";
import type { ChatImage } from "../ai";
import { learnInBackground } from "../services/learning.service";

export const chatRouter = Router();

/**
 * Attachments arrive base64-encoded in the JSON body. There is no persistent
 * disk on Render or Vercel, so image attachments are stored in Postgres as
 * data URLs rather than written to a filesystem that vanishes on redeploy.
 * That is only reasonable for modest files, hence the cap.
 */
const MAX_LIBRARY_BYTES = 1_500_000; // ~1.5 MB of decoded image data
const MAX_ATTACHMENT_BYTES = 5_000_000; // ~5 MB, rejected outright above this

const attachmentSchema = z.object({
  name: z.string().min(1).max(255),
  mediaType: z.string().min(1).max(120),
  base64: z.string().min(1),
});

const chatSchema = z.object({
  message: z.string().default(""),
  conversationId: z.string().optional(),
  projectId: z.string().optional(),
  attachments: z.array(attachmentSchema).max(10).default([]),
  webSearchEnabled: z.boolean().default(false),
});

type Attachment = z.infer<typeof attachmentSchema>;

function decodedByteLength(base64: string): number {
  // Base64 encodes 3 bytes per 4 characters, minus padding.
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

async function saveAttachmentsToLibrary(
  userId: string,
  conversationId: string,
  prompt: string,
  attachments: Attachment[]
) {
  for (const att of attachments) {
    const isImage = att.mediaType.startsWith("image/");
    const size = decodedByteLength(att.base64);

    // Documents and oversized images are recorded by name only. Storing a
    // placeholder URL would make the Library render broken thumbnails, so the
    // row carries an empty url and the UI shows a file card instead.
    const storable = isImage && size <= MAX_LIBRARY_BYTES;

    await db.insert(schema.libraryAssets).values({
      userId,
      type: isImage ? "image" : "document",
      url: storable ? `data:${att.mediaType};base64,${att.base64}` : "",
      name: att.name,
      mediaType: att.mediaType,
      prompt,
      conversationId,
    });
  }
}

/**
 * With chat history off, the conversation still has to exist while the turn is
 * running — the model needs the message, and the reply has to be written
 * somewhere before it is streamed. It is removed immediately afterwards, taking
 * its messages and attachments with it via ON DELETE CASCADE.
 *
 * The alternative, never persisting at all, would mean rewriting the whole
 * request path around an in-memory conversation for one setting. Deleting after
 * the fact leaves nothing behind either way.
 */
async function discardConversation(conversationId: string) {
  await db
    .delete(schema.conversations)
    .where(eq(schema.conversations.id, conversationId));
}

chatRouter.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.userId!;

    const parsed = chatSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
      return;
    }

    const { message, conversationId, projectId, attachments, webSearchEnabled } =
      parsed.data;

    if (!message.trim() && attachments.length === 0) {
      res.status(400).json({ error: "Message cannot be empty" });
      return;
    }

    const oversized = attachments.find(
      (a) => decodedByteLength(a.base64) > MAX_ATTACHMENT_BYTES
    );
    if (oversized) {
      res.status(413).json({
        error: `"${oversized.name}" is larger than the 5 MB attachment limit.`,
      });
      return;
    }

    const provider = getProvider();
    if (!provider.isConfigured()) {
      res.status(503).json({
        error:
          "No AI provider is configured. Set ANTHROPIC_API_KEY on the server to enable real responses.",
      });
      return;
    }

    const conversation = await getOrCreateConversation({
      userId,
      conversationId,
      projectId,
    });
    const isFirstMessage = (conversation.messages?.length ?? 0) === 0;

    const imageAttachments = attachments.filter((a) =>
      a.mediaType.startsWith("image/")
    );
    const otherAttachments = attachments.filter(
      (a) => !a.mediaType.startsWith("image/")
    );

    let storedContent = message;
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
      await saveAttachmentsToLibrary(
        userId,
        conversation.id,
        message,
        attachments
      );
      await recordUsage(userId, "tool_call");
    }

    if (isFirstMessage) {
      await maybeTitleConversation(
        conversation.id,
        message || attachments[0]?.name || "New Chat"
      );
    }

    const {
      assistantName,
      responseStyle,
      model,
      memoryEntries,
      customInstructions,
      chatHistoryEnabled,
    } = await getUserPreferences(userId);

    if (webSearchEnabled) await recordUsage(userId, "tool_call");

    // Search runs inside the provider now — the model issues its own queries
    // server-side rather than us pre-fetching results and pasting them in.
    const webSearchNote = webSearchEnabled
      ? `\n\nWeb search is available to you for this message. Use it when the answer depends on current information, and cite what you used.`
      : "";

    const history = await buildMessageHistory(conversation.id);
    // Images ride along with the live turn only — they are not replayed into
    // future requests, which would multiply cost on every subsequent message.
    if (imageAttachments.length > 0 && history.length > 0) {
      const last = history[history.length - 1];
      last.images = imageAttachments.map<ChatImage>((a) => ({
        mediaType: a.mediaType,
        data: a.base64,
      }));
    }

    const systemPrompt =
      getSystemPrompt(
        assistantName,
        responseStyle,
        memoryEntries,
        customInstructions
      ) + webSearchNote;

    const title =
      isFirstMessage && message
        ? message.slice(0, 60).trim()
        : conversation.title;

    const wantsStream = (req.headers.accept ?? "").includes("text/event-stream");

    // ---- Streaming path (web client) ----
    if (wantsStream) {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        // Render sits behind a proxy that buffers responses by default; without
        // this the whole stream arrives at once and the typing effect is lost.
        "X-Accel-Buffering": "no",
      });

      const send = (event: string, data: unknown) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      send("meta", { conversationId: conversation.id, title });

      let fullText = "";
      let clientGone = false;
      req.on("close", () => {
        clientGone = true;
      });

      try {
        for await (const chunk of provider.streamCompletion(history, {
          systemPrompt,
          model,
          webSearch: webSearchEnabled,
        })) {
          if (clientGone) break;
          if (chunk.type === "text" && chunk.text) {
            fullText += chunk.text;
            send("chunk", { text: chunk.text });
          } else if (chunk.type === "searching") {
            send("searching", {});
          } else if (chunk.type === "sources") {
            send("sources", { sources: chunk.sources });
          } else if (chunk.type === "error") {
            send("error", { message: chunk.error });
          }
        }

        // Persist whatever was generated even if the user hit stop — a partial
        // answer they saw on screen should still be there on reload.
        if (fullText.trim().length > 0) {
          await saveMessage(conversation.id, "assistant", fullText);
        }

        // After the reply is out, not before — this must never delay it.
        if (fullText.trim()) {
          learnInBackground({
            userId,
            userMessage: message,
            assistantMessage: fullText,
          });
        }

        if (!chatHistoryEnabled) await discardConversation(conversation.id);

        if (!clientGone) send("done", {});
      } catch (err) {
        if (!clientGone) {
          send("error", {
            message: err instanceof Error ? err.message : "Generation failed",
          });
        }
      } finally {
        res.end();
      }
      return;
    }

    // ---- Non-streaming path (mobile client) ----
    let fullText = "";
    let streamError: string | null = null;

    const collectedSources: { title: string; url: string }[] = [];

    for await (const chunk of provider.streamCompletion(history, {
      systemPrompt,
      model,
      webSearch: webSearchEnabled,
    })) {
      if (chunk.type === "text" && chunk.text) fullText += chunk.text;
      else if (chunk.type === "sources" && chunk.sources)
        collectedSources.push(...chunk.sources);
      else if (chunk.type === "error")
        streamError = chunk.error ?? "Generation failed";
    }

    if (streamError && !fullText) {
      res.status(502).json({ error: streamError });
      return;
    }

    if (fullText.trim().length > 0) {
      await saveMessage(conversation.id, "assistant", fullText);
      learnInBackground({
        userId,
        userMessage: message,
        assistantMessage: fullText,
      });
    }

    if (!chatHistoryEnabled) await discardConversation(conversation.id);

    res.json({
      conversationId: conversation.id,
      title,
      reply: fullText,
      ...(collectedSources.length ? { sources: collectedSources } : {}),
      ...(chatHistoryEnabled ? {} : { retained: false }),
      ...(streamError ? { warning: streamError } : {}),
    });
  })
);
