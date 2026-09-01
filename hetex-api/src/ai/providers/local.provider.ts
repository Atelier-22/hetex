import {
  getLocalRuntimeStatus,
  type LocalRuntimeStatus,
} from "../local-runtime";
import { env } from "../../env";
import { generateLocal } from "../local-model";
import type {
  AIProvider,
  ChatMessage,
  GenerationOptions,
  ProviderCapabilities,
  StreamChunk,
} from "../provider.interface";

/**
 * Local AI, as a first-class provider.
 *
 * Needs no API key and sends nothing off the host — that is the whole point of
 * it, and it is what lets the Privacy screen say "processing locally" and mean
 * it.
 *
 * `isConfigured()` and `models` are synchronous on the AIProvider interface but
 * the underlying runtime has to be probed over HTTP or the filesystem, so a
 * snapshot is refreshed in the background and read synchronously here. A stale
 * snapshot can at worst offer a model that has just been deleted, which fails
 * with the runtime's own message rather than silently answering from something
 * else.
 */
export class LocalProvider implements AIProvider {
  readonly id = "local";
  readonly displayName = "Local AI";

  readonly capabilities: ProviderCapabilities = {
    // No local runtime here exposes a server-side search tool.
    webSearch: false,
    images: false,
    temperature: true,
  };

  private snapshot: LocalRuntimeStatus | null = null;
  private refreshing: Promise<void> | null = null;
  private refreshedAt = 0;

  constructor() {
    void this.refresh();
  }

  private async refresh(): Promise<void> {
    if (this.refreshing) return this.refreshing;
    this.refreshing = getLocalRuntimeStatus()
      .then((s) => {
        this.snapshot = s;
        this.refreshedAt = Date.now();
      })
      .catch(() => {
        this.snapshot = null;
      })
      .finally(() => {
        this.refreshing = null;
      });
    return this.refreshing;
  }

  /** Kicks off a background refresh when the snapshot has gone stale. */
  private snapshotNow(): LocalRuntimeStatus | null {
    if (Date.now() - this.refreshedAt > 30_000) void this.refresh();
    return this.snapshot;
  }

  get models() {
    const status = this.snapshotNow();
    if (!status?.available) return [];

    return status.models
      .filter((m) => !m.capabilities.embedding)
      .map((m) => ({
        // Namespaced so a local model can never collide with a hosted tier.
        id: `local:${m.id}`,
        modelId: m.id,
        label: `${m.name} (on this server)`,
        description: [
          "Runs on the Hetex server itself — nothing is sent to an external provider.",
          m.parameterSize ? `${m.parameterSize} parameters.` : null,
          m.contextLength ? `${m.contextLength.toLocaleString()} token context.` : null,
          "Cannot search the web or read images.",
        ]
          .filter(Boolean)
          .join(" "),
      }));
  }

  isConfigured(): boolean {
    return this.snapshotNow()?.available === true;
  }

  async *streamCompletion(
    messages: ChatMessage[],
    options?: GenerationOptions
  ): AsyncGenerator<StreamChunk> {
    const status = this.snapshot ?? (await getLocalRuntimeStatus());

    if (!status.available) {
      yield {
        type: "error",
        error:
          status.requirement ??
          "No local AI runtime is available on this server.",
      };
      return;
    }

    if (status.runtime === "ollama") {
      yield* this.streamOllama(messages, options, status);
      return;
    }

    // llama.cpp path: node-llama-cpp answers in one go here, so the reply
    // arrives as a single chunk rather than being faked into fragments.
    try {
      const prompt = messages
        .filter((m) => m.role !== "system")
        .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
        .join("\n\n");

      const text = await generateLocal(prompt, options?.systemPrompt);
      if (text) yield { type: "text", text };
      yield { type: "done" };
    } catch (err) {
      yield {
        type: "error",
        error: err instanceof Error ? err.message : "The local model failed",
      };
    }
  }

  private async *streamOllama(
    messages: ChatMessage[],
    options: GenerationOptions | undefined,
    status: LocalRuntimeStatus
  ): AsyncGenerator<StreamChunk> {
    const model = options?.model ?? status.models[0]?.id;
    if (!model) {
      yield {
        type: "error",
        error: "No local model is installed. Install one in Settings → Local AI.",
      };
      return;
    }

    try {
      const res = await fetch(
        `${env.OLLAMA_BASE_URL.replace(/\/$/, "")}/api/chat`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            stream: true,
            messages: [
              ...(options?.systemPrompt
                ? [{ role: "system", content: options.systemPrompt }]
                : []),
              ...messages
                .filter((m) => m.role !== "system")
                .map((m) => ({ role: m.role, content: m.content })),
            ],
            options: {
              ...(options?.maxTokens ? { num_predict: options.maxTokens } : {}),
              ...(options?.temperature !== undefined
                ? { temperature: options.temperature }
                : {}),
            },
          }),
        }
      );

      if (!res.ok || !res.body) {
        yield {
          type: "error",
          error: `The local runtime returned HTTP ${res.status}`,
        };
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          let evt: { message?: { content?: string }; error?: string; done?: boolean };
          try {
            evt = JSON.parse(line);
          } catch {
            continue;
          }
          if (evt.error) {
            yield { type: "error", error: evt.error };
            return;
          }
          const text = evt.message?.content;
          if (text) yield { type: "text", text };
        }
      }

      yield { type: "done" };
    } catch (err) {
      yield {
        type: "error",
        error: err instanceof Error ? err.message : "The local runtime failed",
      };
    }
  }
}
