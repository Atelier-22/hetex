import { Router } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, schema } from "../db";
import { requireAuth, asyncHandler } from "../auth/middleware";
import {
  getOrCreateConversation,
  saveMessage,
  maybeTitleConversation,
  recordUsage,
  buildMessageHistory,
  buildSystemPrompt,
  getChatContext,
} from "../services/chat.service";
import { getProvider, providerForModel, resolveModelId } from "../ai";
import type { ChatImage, ChatMessage, StreamChunk } from "../ai";
import { selectModel } from "../ai/routing";
import { generateLocal, isLocalModelAvailable } from "../ai/local-model";
import { learnInBackground } from "../services/learning.service";
import { getPlatformConfig } from "../settings/platform";
import { checkLimit } from "../services/limits.service";
import type { UserSettings } from "../settings/schema";

export const chatRouter = Router();

/**
 * Attachments arrive base64-encoded in the JSON body. There is no persistent
 * disk on Render or Vercel, so image attachments are stored in Postgres as
 * data URLs rather than written to a filesystem that vanishes on redeploy.
 * That is only reasonable for modest files, hence the cap.
 */
const MAX_LIBRARY_BYTES = 1_500_000; // ~1.5 MB of decoded image data

const NO_PROVIDER_MESSAGE =
  "No AI provider is configured on this server, so replies aren't available.";

const attachmentSchema = z.object({
  name: z.string().min(1).max(255),
  mediaType: z.string().min(1).max(120),
  base64: z.string().min(1),
});

const chatSchema = z.object({
  message: z.string().default(""),
  conversationId: z.string().optional(),
  projectId: z.string().optional(),
  attachments: z.array(attachmentSchema).max(20).default([]),
  webSearchEnabled: z.boolean().default(false),
  /** Per-turn override of "remember this conversation". */
  excludeFromMemory: z.boolean().optional(),
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
 */
async function discardConversation(conversationId: string) {
  await db
    .delete(schema.conversations)
    .where(eq(schema.conversations.id, conversationId));
}

/** Attachments belonging to this turn, removed once the reply is delivered. */
async function discardTurnAttachments(conversationId: string) {
  await db
    .delete(schema.libraryAssets)
    .where(eq(schema.libraryAssets.conversationId, conversationId));
}

/**
 * Last resort when the hosted provider fails outright.
 *
 * Only runs when the account has left "fall back to the local model" on — it is
 * a different model answering, and someone who has turned that off has said
 * they would rather see the error.
 */
async function localFallbackReply(
  prompt: string,
  systemPrompt: string,
  settings: UserSettings
): Promise<string | null> {
  if (!settings.ai.fallbackToLocal) return null;
  if (!prompt.trim() || !isLocalModelAvailable()) return null;

  try {
    const text = await generateLocal(prompt, systemPrompt);
    return text.trim() ? text : null;
  } catch (err) {
    console.error(
      "Local fallback failed:",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * The account's chosen fallback model, tried before the local one.
 *
 * Only used when the first attempt produced nothing at all — half an answer
 * finished by a different model would read as one reply that changes voice
 * mid-sentence.
 */
async function fallbackModelReply(
  history: ChatMessage[],
  systemPrompt: string,
  settings: UserSettings,
  failedModel: string
): Promise<{ text: string; model: string } | null> {
  const target = settings.advanced.fallbackModel;
  if (!target || target === failedModel) return null;

  const provider = providerForModel(target);
  if (!provider.isConfigured()) return null;

  try {
    let text = "";
    for await (const chunk of provider.streamCompletion(history, {
      systemPrompt,
      model: resolveModelId(target),
      maxTokens: settings.advanced.maxOutputTokens,
      ...(provider.capabilities.temperature
        ? { temperature: settings.advanced.temperature }
        : {}),
    })) {
      if (chunk.type === "text" && chunk.text) text += chunk.text;
      else if (chunk.type === "error") return null;
    }
    return text.trim() ? { text, model: target } : null;
  } catch (err) {
    console.error(
      "Fallback model failed:",
      err instanceof Error ? err.message : err
    );
    return null;
  }
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

    const {
      message,
      conversationId,
      projectId,
      attachments,
      webSearchEnabled,
      excludeFromMemory,
    } = parsed.data;

    if (!message.trim() && attachments.length === 0) {
      res.status(400).json({ error: "Message cannot be empty" });
      return;
    }

    const config = await getPlatformConfig();

    if (!config.features.chat) {
      res.status(503).json({
        error: "Chat is currently unavailable. An administrator has turned it off.",
      });
      return;
    }

    // Enforced here, not in the browser. A patched client changes nothing.
    const allowance = await checkLimit(userId, "message");
    if (!allowance.allowed) {
      res.status(429).json({ error: allowance.message, limit: allowance.limit });
      return;
    }

    const { user, settings, memoryEntries } = await getChatContext(userId);

    // ---- Attachment policy ------------------------------------------------
    if (attachments.length > 0 && !config.features.fileUploads) {
      res.status(503).json({
        error: "File uploads are currently unavailable on this server.",
      });
      return;
    }

    if (attachments.length > config.limits.maxAttachmentsPerMessage) {
      res.status(400).json({
        error: `You can attach at most ${config.limits.maxAttachmentsPerMessage} files to one message.`,
      });
      return;
    }

    const maxBytes = config.limits.maxUploadMb * 1_000_000;
    const oversized = attachments.find(
      (a) => decodedByteLength(a.base64) > maxBytes
    );
    if (oversized) {
      res.status(413).json({
        error: `"${oversized.name}" is larger than the ${config.limits.maxUploadMb} MB attachment limit.`,
      });
      return;
    }

    const disallowed = attachments.find(
      (a) => !config.allowedFileTypes.includes(a.mediaType)
    );
    if (disallowed) {
      res.status(415).json({
        error: `"${disallowed.name}" is a file type this server does not accept.`,
      });
      return;
    }

    // ---- Model selection --------------------------------------------------
    const imageAttachments = attachments.filter((a) =>
      a.mediaType.startsWith("image/")
    );
    const otherAttachments = attachments.filter(
      (a) => !a.mediaType.startsWith("image/")
    );

    const analyseImages =
      settings.images.analysisEnabled &&
      settings.images.autoAnalyzeUploads &&
      config.features.imageAnalysis;

    const routing = selectModel(settings, {
      message,
      hasImages: imageAttachments.length > 0 && analyseImages,
      historyLength: 0,
    });

    let chosenModel = routing.model;

    // "Process locally only" is a privacy promise, so it overrides the model
    // choice rather than being one input among several.
    if (settings.privacy.localOnly || settings.ai.provider === "local") {
      const localProvider = getProvider("local");
      const localModel = localProvider.models[0]?.id;
      if (!localModel) {
        res.status(503).json({
          error:
            "This account is set to process everything locally, but no local model is available on this server.",
        });
        return;
      }
      chosenModel = localModel;
    }

    const provider = providerForModel(chosenModel);
    const vendorModel = resolveModelId(chosenModel);

    const providerUsable = provider.isConfigured();
    if (!providerUsable && !isLocalModelAvailable()) {
      res.status(503).json({ error: NO_PROVIDER_MESSAGE });
      return;
    }

    // ---- Conversation -----------------------------------------------------
    const conversation = await getOrCreateConversation({
      userId,
      conversationId,
      projectId,
    });
    const isFirstMessage = (conversation.messages?.length ?? 0) === 0;

    if (excludeFromMemory !== undefined) {
      await db
        .update(schema.conversations)
        .set({ excludeFromMemory })
        .where(eq(schema.conversations.id, conversation.id));
    }
    const memoryExcluded =
      excludeFromMemory ?? conversation.excludeFromMemory ?? false;

    // Project instructions ride along with the prompt when the account has
    // project context switched on.
    let projectInstructions: string | null = null;
    if (conversation.projectId && settings.projects.useProjectContext) {
      const project = await db.query.projects.findFirst({
        where: and(
          eq(schema.projects.id, conversation.projectId),
          eq(schema.projects.userId, userId)
        ),
        columns: { instructions: true },
      });
      projectInstructions = project?.instructions ?? null;
    }

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

    if (attachments.length > 0 && settings.images.saveUploads) {
      await saveAttachmentsToLibrary(
        userId,
        conversation.id,
        message,
        attachments
      );
      await recordUsage(userId, "tool_call");
    }

    if (isFirstMessage && settings.conversation.autoTitle) {
      await maybeTitleConversation(
        conversation.id,
        message || attachments[0]?.name || "New Chat"
      );
    }

    // ---- Turn-specific prompt notes ---------------------------------------
    const wantsSearch = settings.ai.webSearch && config.features.webSearch;
    const canSearch = providerUsable && provider.capabilities.webSearch && wantsSearch;

    if (webSearchEnabled && canSearch) await recordUsage(userId, "tool_call");

    const notes: string[] = [];

    if (canSearch) {
      notes.push(
        `\n\nYou can search the web. Use it whenever an answer depends on current information — news, prices, releases, anything that changes, or anything you are not confident is still true. Search rather than saying you cannot access the internet, because you can. For things that do not change, answer directly without searching.`
      );
      if (webSearchEnabled) {
        notes.push(
          `\n\nThe user has explicitly asked you to look this up. Search the web for this message even if you think you know the answer, and cite what you used.`
        );
      }
    } else {
      notes.push(
        // Without this the model claims live knowledge it does not have. It
        // must know its own limits for this turn.
        `\n\nYou cannot search the web on this model. If the answer depends on current information, say plainly that you can't look it up here, rather than guessing.`
      );
    }

    // An image sent to a text-only model would otherwise vanish silently and
    // the reply would look like the model simply ignored it.
    const droppedImages =
      imageAttachments.length > 0 &&
      (!provider.capabilities.images || !analyseImages);

    if (droppedImages) {
      notes.push(
        settings.images.analysisEnabled
          ? `\n\nThe user attached an image, but it cannot be looked at on this model. Tell them so directly and suggest switching model in Settings if they need it read.`
          : `\n\nThe user attached an image, but they have turned image analysis off in Settings. Say so plainly and tell them where to turn it back on.`
      );
    }

    if (settings.privacy.localOnly) {
      notes.push(
        `\n\nThis account is set to process everything on this server. You have no web access and no external tools for this conversation.`
      );
    }

    const history = await buildMessageHistory(conversation.id);
    // Images ride along with the live turn only — they are not replayed into
    // future requests, which would multiply cost on every subsequent message.
    if (imageAttachments.length > 0 && !droppedImages && history.length > 0) {
      const last = history[history.length - 1];
      last.images = imageAttachments.map<ChatImage>((a) => ({
        mediaType: a.mediaType,
        data: a.base64,
      }));
    }

    const systemPrompt = buildSystemPrompt({
      user,
      settings,
      memoryEntries,
      projectInstructions,
      notes,
    });

    const generation = {
      systemPrompt,
      model: vendorModel,
      webSearch: canSearch,
      maxTokens: settings.advanced.maxOutputTokens,
      // Only sent where the provider accepts one. Some vendors reject the
      // parameter on their current models, so sending it there would fail the
      // request rather than change the output.
      ...(provider.capabilities.temperature
        ? { temperature: settings.advanced.temperature }
        : {}),
    };

    const title =
      isFirstMessage && message && settings.conversation.autoTitle
        ? message.slice(0, 60).trim()
        : conversation.title;

    /** Runs after a reply has been delivered, never before. */
    const afterReply = async (fullText: string) => {
      if (fullText.trim() && settings.memory.enabled && !memoryExcluded) {
        learnInBackground({
          userId,
          userMessage: message,
          assistantMessage: fullText,
        });
      }

      if (!settings.conversation.saveConversations) {
        await discardConversation(conversation.id);
      } else if (
        settings.images.deleteAfterConversation ||
        settings.files.deleteAfterConversation
      ) {
        await discardTurnAttachments(conversation.id);
      }
    };

    const meta = {
      conversationId: conversation.id,
      title,
      model: chosenModel,
      routed: routing.routed,
      routingReason: routing.reason,
      task: routing.task,
      processedLocally: provider.id === "local",
      excludeFromMemory: memoryExcluded,
    };

    const wantsStream =
      (req.headers.accept ?? "").includes("text/event-stream") &&
      settings.advanced.streaming;

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

      send("meta", meta);

      let fullText = "";
      let providerError: string | null = null;
      let clientGone = false;
      req.on("close", () => {
        clientGone = true;
      });

      try {
        const stream = providerUsable
          ? provider.streamCompletion(history, generation)
          : ([{ type: "error", error: NO_PROVIDER_MESSAGE }] as StreamChunk[]);

        for await (const chunk of stream) {
          if (clientGone) break;
          if (chunk.type === "text" && chunk.text) {
            fullText += chunk.text;
            send("chunk", { text: chunk.text });
          } else if (chunk.type === "searching") {
            send("searching", {});
          } else if (chunk.type === "sources") {
            send("sources", { sources: chunk.sources });
          } else if (chunk.type === "error") {
            // Held back rather than sent: the local model may still answer, and
            // an error the user never needed to see is noise.
            providerError = chunk.error ?? "Generation failed";
          }
        }

        if (providerError && !clientGone) {
          // Only a turn that produced nothing is worth retrying. Half an answer
          // plus a different model finishing it would read as one reply that
          // changes voice mid-sentence.
          const retry = fullText.trim()
            ? null
            : await fallbackModelReply(
                history,
                systemPrompt,
                settings,
                chosenModel
              );

          const local =
            retry || fullText.trim()
              ? null
              : await localFallbackReply(message, systemPrompt, settings);

          if (retry) {
            fullText = retry.text;
            send("chunk", { text: retry.text });
            send("meta", { ...meta, model: retry.model, fellBack: true });
          } else if (local) {
            fullText = local;
            send("chunk", { text: local });
            send("meta", { ...meta, processedLocally: true, fellBack: true });
          } else {
            send("error", { message: providerError });
          }
        }

        // Persist whatever was generated even if the user hit stop — a partial
        // answer they saw on screen should still be there on reload.
        if (fullText.trim().length > 0) {
          await saveMessage(conversation.id, "assistant", fullText);
        }

        await afterReply(fullText);

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

    if (!providerUsable) {
      streamError = NO_PROVIDER_MESSAGE;
    } else {
      for await (const chunk of provider.streamCompletion(history, generation)) {
        if (chunk.type === "text" && chunk.text) fullText += chunk.text;
        else if (chunk.type === "sources" && chunk.sources)
          collectedSources.push(...chunk.sources);
        else if (chunk.type === "error")
          streamError = chunk.error ?? "Generation failed";
      }
    }

    if (streamError && !fullText) {
      const retry = await fallbackModelReply(
        history,
        systemPrompt,
        settings,
        chosenModel
      );
      const local = retry
        ? null
        : await localFallbackReply(message, systemPrompt, settings);

      if (retry) {
        fullText = retry.text;
        streamError = null;
      } else if (local) {
        fullText = local;
        streamError = null;
      } else {
        res.status(502).json({ error: streamError });
        return;
      }
    }

    if (fullText.trim().length > 0) {
      await saveMessage(conversation.id, "assistant", fullText);
    }

    await afterReply(fullText);

    res.json({
      ...meta,
      reply: fullText,
      ...(collectedSources.length ? { sources: collectedSources } : {}),
      ...(settings.conversation.saveConversations ? {} : { retained: false }),
      ...(streamError ? { warning: streamError } : {}),
    });
  })
);
