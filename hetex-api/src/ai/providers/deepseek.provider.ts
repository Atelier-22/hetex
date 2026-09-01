import { env } from "../../env";
import type {
  AIProvider,
  ChatMessage,
  GenerationOptions,
  ProviderCapabilities,
  StreamChunk,
} from "../provider.interface";

/**
 * DeepSeek.
 *
 * The API is OpenAI-compatible, so this speaks that shape over plain fetch
 * rather than pulling in an SDK for one endpoint — the surface used here is a
 * single streaming POST.
 *
 * Two real limitations, declared rather than hidden: no server-side web search,
 * and the chat models are text-only. The chat route reads `capabilities` and
 * tells the user instead of quietly dropping an image or promising a search
 * that will not happen.
 */
export class DeepSeekProvider implements AIProvider {
  readonly id = "deepseek";
  /** Internal only — never sent to the client. */
  readonly displayName = "DeepSeek";

  readonly capabilities: ProviderCapabilities = {
    webSearch: false,
    images: false,
    temperature: true,
  };

  readonly models = [
    {
      id: "fast",
      modelId: "deepseek-chat",
      label: "Fast",
      description:
        "Quick and inexpensive, strong at writing and code. Cannot search the web or read images.",
    },
    {
      id: "reasoning",
      modelId: "deepseek-reasoner",
      label: "Reasoning",
      description:
        "Works through problems step by step before answering — better at hard maths and logic, and slower. Cannot search the web or read images.",
    },
  ];

  isConfigured(): boolean {
    return Boolean(env.DEEPSEEK_API_KEY);
  }

  async *streamCompletion(
    messages: ChatMessage[],
    options?: GenerationOptions
  ): AsyncGenerator<StreamChunk> {
    if (!env.DEEPSEEK_API_KEY) {
      yield {
        type: "error",
        error: "DeepSeek is not configured on this server.",
      };
      return;
    }

    // OpenAI-shaped: the system prompt is the first message rather than a
    // separate field, and there is no image content type on these models.
    const payload = {
      model: options?.model ?? "deepseek-chat",
      max_tokens: options?.maxTokens ?? 4096,
      // Sent only when the account has set one — otherwise the provider's own
      // default applies, which is the right behaviour for an untouched setting.
      ...(options?.temperature !== undefined
        ? { temperature: options.temperature }
        : {}),
      stream: true,
      messages: [
        ...(options?.systemPrompt
          ? [{ role: "system" as const, content: options.systemPrompt }]
          : []),
        ...messages
          .filter((m) => m.role !== "system")
          .map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content || "(no text)",
          })),
      ],
    };

    let response: Response;
    try {
      response = await fetch(`${env.DEEPSEEK_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify(payload),
        // Without a ceiling a hung upstream would hold the request open until
        // the platform kills it, with nothing useful shown to the user.
        signal: AbortSignal.timeout(180_000),
      });
    } catch (err) {
      console.error("DeepSeek request failed:", err);
      yield {
        type: "error",
        error: "Couldn't reach the AI service. Try again shortly.",
      };
      return;
    }

    if (!response.ok || !response.body) {
      const detail = await response.text().catch(() => "");
      console.error(`DeepSeek error ${response.status}:`, detail.slice(0, 400));
      yield { type: "error", error: describeError(response.status) };
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE frames are separated by a blank line; a frame can arrive split
        // across reads, so the trailing partial is kept for the next pass.
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          const line = frame
            .split("\n")
            .find((l) => l.startsWith("data: "));
          if (!line) continue;

          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta;

            // deepseek-reasoner streams its chain of thought separately. It is
            // deliberately not forwarded: it is long, it is not the answer, and
            // showing it would bury the reply.
            const text = delta?.content;
            if (typeof text === "string" && text.length > 0) {
              yield { type: "text", text };
            }
          } catch {
            // A malformed frame is not worth killing the stream over.
          }
        }
      }

      yield { type: "done" };
    } catch (err) {
      console.error("DeepSeek stream failed:", err);
      yield { type: "error", error: "The response was cut short. Try again." };
    } finally {
      reader.releaseLock();
    }
  }
}

function describeError(status: number): string {
  if (status === 401) {
    return "The AI service rejected our credentials. This is a server configuration problem, not something you did.";
  }
  if (status === 402) {
    return "The AI service account is out of credit. The account owner needs to top it up.";
  }
  if (status === 429) {
    return "The AI service is busy right now. Wait a moment and try again.";
  }
  if (status >= 500) {
    return "The AI service is having trouble on its end. Try again shortly.";
  }
  return `The AI service returned an error (${status}). Try again shortly.`;
}
