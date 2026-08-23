import Anthropic from "@anthropic-ai/sdk";
import { env } from "../../env";
import type {
  AIProvider,
  ChatMessage,
  GenerationOptions,
  StreamChunk,
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

      // `temperature` is deliberately not sent: it is rejected with a 400 on
      // Sonnet 5 / Opus 5 and the 4.7+ family, so omitting it keeps
      // ANTHROPIC_MODEL swappable without a code change.
      const stream = client.messages.stream({
        model: options?.model ?? env.ANTHROPIC_MODEL,
        max_tokens: options?.maxTokens ?? 4096,
        ...(systemPrompt ? { system: systemPrompt } : {}),
        messages: turnMessages,
      });

      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          yield { type: "text", text: event.delta.text };
        }
      }

      yield { type: "done" };
    } catch (err) {
      yield {
        type: "error",
        error: describeProviderError(err),
      };
    }
  }
}

function describeProviderError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) {
    return "The AI provider rejected the API key. Check ANTHROPIC_API_KEY on the server.";
  }
  if (err instanceof Anthropic.RateLimitError) {
    return "The AI provider is rate limiting requests right now. Try again in a moment.";
  }
  if (err instanceof Anthropic.BadRequestError) {
    return `The AI provider rejected the request: ${err.message}`;
  }
  if (err instanceof Anthropic.APIError) {
    return `AI provider error (${err.status}): ${err.message}`;
  }
  return err instanceof Error ? err.message : "Unknown provider error";
}
