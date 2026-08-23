import Anthropic from "@anthropic-ai/sdk";
import type {
  AIProvider,
  ChatMessage,
  GenerationOptions,
  StreamChunk,
} from "../provider.interface";

const DEFAULT_MODEL = "claude-sonnet-4-6";

export class AnthropicProvider implements AIProvider {
  readonly id = "anthropic";
  readonly displayName = "Claude (Anthropic)";

  private client: Anthropic | null = null;

  private getClient(): Anthropic {
    if (!this.client) {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error(
          "ANTHROPIC_API_KEY is not set. Add it to your .env file."
        );
      }
      this.client = new Anthropic({ apiKey });
    }
    return this.client;
  }

  isConfigured(): boolean {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  }

  async *streamCompletion(
    messages: ChatMessage[],
    options?: GenerationOptions
  ): AsyncGenerator<StreamChunk> {
    try {
      const client = this.getClient();

      // Anthropic's Messages API keeps system prompt separate from the
      // conversation turns, and disallows role: "system" inside messages.
      const systemMessages = messages.filter((m) => m.role === "system");
      const turnMessages = messages
        .filter((m) => m.role !== "system")
        .map((m) => {
          if (m.images && m.images.length > 0) {
            return {
              role: m.role as "user" | "assistant",
              content: [
                ...m.images.map((img) => ({
                  type: "image" as const,
                  source: {
                    type: "base64" as const,
                    media_type: img.mediaType as
                      | "image/jpeg"
                      | "image/png"
                      | "image/gif"
                      | "image/webp",
                    data: img.data,
                  },
                })),
                { type: "text" as const, text: m.content },
              ],
            };
          }
          return {
            role: m.role as "user" | "assistant",
            content: m.content,
          };
        });

      const systemPrompt =
        options?.systemPrompt ??
        systemMessages.map((m) => m.content).join("\n\n") ??
        undefined;

      const stream = client.messages.stream({
        model: options?.model ?? DEFAULT_MODEL,
        max_tokens: options?.maxTokens ?? 2048,
        temperature: options?.temperature ?? 1,
        system: systemPrompt,
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
        error: err instanceof Error ? err.message : "Unknown provider error",
      };
    }
  }
}
