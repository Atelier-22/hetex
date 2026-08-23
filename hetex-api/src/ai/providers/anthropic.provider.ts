import Anthropic from "@anthropic-ai/sdk";
import { env } from "../../env";
import type {
  AIProvider,
  ChatMessage,
  GenerationOptions,
  StreamChunk,
  WebSource,
} from "../provider.interface";

type SupportedImageMediaType =
  | "image/jpeg"
  | "image/png"
  | "image/gif"
  | "image/webp";

const SUPPORTED_IMAGE_TYPES: SupportedImageMediaType[] = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

function isSupportedImageType(
  mediaType: string
): mediaType is SupportedImageMediaType {
  return (SUPPORTED_IMAGE_TYPES as string[]).includes(mediaType);
}

export class AnthropicProvider implements AIProvider {
  readonly id = "anthropic";
  readonly displayName = "Claude (Anthropic)";

  private client: Anthropic | null = null;

  private getClient(): Anthropic {
    if (!this.client) {
      if (!env.ANTHROPIC_API_KEY) {
        throw new Error(
          "ANTHROPIC_API_KEY is not set. Add it to the backend environment."
        );
      }
      this.client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    }
    return this.client;
  }

  isConfigured(): boolean {
    return Boolean(env.ANTHROPIC_API_KEY);
  }

  async *streamCompletion(
    messages: ChatMessage[],
    options?: GenerationOptions
  ): AsyncGenerator<StreamChunk> {
    try {
      const client = this.getClient();

      // Anthropic's Messages API keeps the system prompt separate from the
      // conversation turns and rejects role: "system" inside messages.
      const systemMessages = messages.filter((m) => m.role === "system");
      const turnMessages: Anthropic.MessageParam[] = messages
        .filter((m) => m.role !== "system")
        .map((m) => {
          const images = (m.images ?? []).filter((img) =>
            isSupportedImageType(img.mediaType)
          );

          if (images.length > 0) {
            return {
              role: m.role as "user" | "assistant",
              content: [
                ...images.map((img) => ({
                  type: "image" as const,
                  source: {
                    type: "base64" as const,
                    media_type: img.mediaType as SupportedImageMediaType,
                    data: img.data,
                  },
                })),
                { type: "text" as const, text: m.content || "(no text)" },
              ],
            };
          }

          return {
            role: m.role as "user" | "assistant",
            content: m.content,
          };
        });

      const systemPrompt =
        options?.systemPrompt ||
        systemMessages.map((m) => m.content).join("\n\n") ||
        undefined;

      // Anthropic runs web search server-side: the model issues the queries,
      // reads the results, and cites them, all inside one request. No search
      // API key of our own and no client-side tool loop.
      const tools = options?.webSearch
        ? [
            {
              type: "web_search_20260209" as const,
              name: "web_search" as const,
              max_uses: 5,
            },
          ]
        : undefined;

      // `temperature` is deliberately not sent: it is rejected with a 400 on
      // Sonnet 5 / Opus 5 and the 4.7+ family, so omitting it keeps
      // ANTHROPIC_MODEL swappable without a code change.
      const stream = client.messages.stream({
        model: options?.model ?? env.ANTHROPIC_MODEL,
        max_tokens: options?.maxTokens ?? 4096,
        ...(systemPrompt ? { system: systemPrompt } : {}),
        ...(tools ? { tools } : {}),
        messages: turnMessages,
      });

      let announcedSearch = false;

      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          yield { type: "text", text: event.delta.text };
        } else if (
          event.type === "content_block_start" &&
          event.content_block.type === "server_tool_use" &&
          !announcedSearch
        ) {
          // Searching adds seconds of silence before any text arrives. Saying
          // so is the difference between "thinking" and "broken".
          announcedSearch = true;
          yield { type: "searching" };
        }
      }

      if (options?.webSearch) {
        const sources = extractSources(await stream.finalMessage());
        if (sources.length > 0) yield { type: "sources", sources };
      }

      yield { type: "done" };
    } catch (err) {
      // The user gets a sentence they can act on; the operator gets the whole
      // thing, including the request id needed to chase it with the provider.
      console.error(
        "Anthropic provider error:",
        err instanceof Error ? err.message : err
      );
      yield {
        type: "error",
        error: describeProviderError(err),
      };
    }
  }
}

/**
 * Turns a provider failure into something worth showing a user.
 *
 * The raw SDK message is often a JSON blob quoting internal request ids, which
 * is noise to the person typing and a hint about our stack to anyone else. The
 * full error is logged server-side by the caller; this is the sentence that
 * reaches the screen.
 */
/**
 * Pulls the pages the model actually read out of a finished message.
 *
 * A web_search_tool_result's `content` is a list on success and a single error
 * object on failure — the tool reports failures as HTTP 200 rather than
 * throwing, so branching on the shape is the only way to tell them apart.
 */
function extractSources(message: Anthropic.Message): WebSource[] {
  const sources: WebSource[] = [];
  const seen = new Set<string>();

  for (const block of message.content) {
    if (block.type !== "web_search_tool_result") continue;
    if (!Array.isArray(block.content)) continue; // an error object, not results

    for (const result of block.content) {
      if (result.type !== "web_search_result") continue;
      if (seen.has(result.url)) continue; // the model often re-reads a page
      seen.add(result.url);
      sources.push({ title: result.title || result.url, url: result.url });
    }
  }

  return sources;
}

function describeProviderError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) {
    return "The AI service rejected our credentials. This is a server configuration problem, not something you did.";
  }

  if (err instanceof Anthropic.RateLimitError) {
    return "The AI service is busy right now. Wait a moment and try again.";
  }

  if (err instanceof Anthropic.BadRequestError) {
    const message = err.message.toLowerCase();

    // Anthropic reports a spend cap or exhausted credit as a 400, which would
    // otherwise read as "you sent something malformed" — the opposite of what
    // actually needs doing, and by whom.
    if (message.includes("usage limit") || message.includes("usage limits")) {
      return "This Hetex account has reached its AI usage limit. The account owner needs to raise the spending limit in the Anthropic console before chat will work again.";
    }
    if (message.includes("credit balance") || message.includes("insufficient")) {
      return "The AI service account is out of credit. The account owner needs to top it up before chat will work again.";
    }
    if (message.includes("too long") || message.includes("max_tokens")) {
      return "This conversation has grown too long for the model to process. Start a new chat to continue.";
    }

    return "The AI service rejected the request. If this keeps happening, the conversation may be too long — try starting a new chat.";
  }

  if (err instanceof Anthropic.APIError) {
    if (err.status && err.status >= 500) {
      return "The AI service is having trouble on its end. Try again shortly.";
    }
    return `The AI service returned an error (${err.status}). Try again shortly.`;
  }

  return "Something went wrong reaching the AI service. Try again.";
}
