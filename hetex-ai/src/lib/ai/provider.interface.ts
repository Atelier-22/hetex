// Hetex AI — Provider Abstraction Layer
//
// Nothing outside this folder should ever import an SDK like `@anthropic-ai/sdk`
// or `openai` directly. Services talk to AIProvider only. This is what lets us
// add OpenAI, Google, DeepSeek, or a future in-house Hetex model later without
// touching chat logic, routes, or UI.

export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  role: ChatRole;
  content: string;
  /** Base64 image attachments for this turn only — not persisted across future turns */
  images?: { mediaType: string; data: string }[];
}

export interface GenerationOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export interface StreamChunk {
  type: "text" | "done" | "error";
  text?: string;
  error?: string;
}

export interface AIProvider {
  /** Unique id used in the model registry, e.g. "anthropic" */
  readonly id: string;

  /** Human-readable name for UI display */
  readonly displayName: string;

  /** Whether this provider is currently usable (e.g. API key present) */
  isConfigured(): boolean;

  /** Stream a completion chunk by chunk */
  streamCompletion(
    messages: ChatMessage[],
    options?: GenerationOptions
  ): AsyncGenerator<StreamChunk>;
}
