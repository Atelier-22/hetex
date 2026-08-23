// Hetex AI — Provider Abstraction Layer
//
// Nothing outside this folder should ever import an SDK like `@anthropic-ai/sdk`
// or `openai` directly. Services talk to AIProvider only. This is what lets us
// add OpenAI, Google, DeepSeek, or a future in-house Hetex model later without
// touching chat logic, routes, or UI.

export type ChatRole = "user" | "assistant" | "system";

export interface ChatImage {
  mediaType: string;
  data: string; // base64, no data: prefix
}

export interface ChatMessage {
  role: ChatRole;
  content: string;
  /** Base64 image attachments for this turn only — not persisted across future turns */
  images?: ChatImage[];
}

export interface GenerationOptions {
  model?: string;
  maxTokens?: number;
  systemPrompt?: string;
  /** Let the model search the web for this turn. */
  webSearch?: boolean;
}

export interface WebSource {
  title: string;
  url: string;
}

export interface StreamChunk {
  type: "text" | "done" | "error" | "searching" | "sources";
  text?: string;
  error?: string;
  /** Present on "sources": the pages the model actually consulted. */
  sources?: WebSource[];
}

/**
 * What a provider can actually do.
 *
 * Providers differ in more than quality — one may not accept images at all, or
 * have no search tool. Declaring it here lets the chat route adapt and tell the
 * user, instead of silently dropping an attachment or promising a search that
 * cannot happen.
 */
export interface ProviderCapabilities {
  webSearch: boolean;
  images: boolean;
}

export interface AIProvider {
  /** Unique id used in the model registry, e.g. "anthropic" */
  readonly id: string;

  /** Human-readable name for UI display */
  readonly displayName: string;

  readonly capabilities: ProviderCapabilities;

  /**
   * Models this provider serves, in the order they should be offered.
   *
   * `id` is the public tier — what the client sees and what is stored against
   * the account. `modelId` is the vendor's own identifier and never leaves the
   * server, so nothing in the API response names the provider.
   */
  readonly models: {
    id: string;
    modelId: string;
    label: string;
    description: string;
  }[];

  /** Whether this provider is currently usable (e.g. API key present) */
  isConfigured(): boolean;

  /** Stream a completion chunk by chunk */
  streamCompletion(
    messages: ChatMessage[],
    options?: GenerationOptions
  ): AsyncGenerator<StreamChunk>;
}
