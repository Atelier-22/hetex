import { providerForModel, resolveModelId } from "./index";
import { generateLocal } from "./local-model";
import { formatSearchResults, searchWeb } from "./web-search";

export type AISource = "api" | "local";

export interface GenerateAIResult {
  text: string;
  source: AISource;
}

export interface GenerateAIOptions {
  /** Public model tier stored against the account, not a vendor model id. */
  model?: string;
  /** Escape hatch for internal tasks that pin a specific vendor model. */
  vendorModel?: string;
  maxTokens?: number;
  /** Prepend free DuckDuckGo results to the prompt as context. */
  useWebSearch?: boolean;
  /**
   * Off by default: a 3B local model synthesises search results poorly, so the
   * fallback answers from its own weights unless this is switched on.
   */
  useWebSearchOnLocal?: boolean;
  /**
   * The task needs function calling, which only the API path can do. On a
   * fallback to local this returns a clear message instead of a broken answer.
   */
  requiresTools?: boolean;
}

const API_TIMEOUT_MS = 8_000;

const TOOLS_UNAVAILABLE_MESSAGE =
  "This request needs tool calling, which is only available when the hosted AI service is reachable. The local fallback model cannot run tools, so this action could not be completed. Try again shortly.";

class ApiTimeoutError extends Error {
  constructor() {
    super(`The AI service did not respond within ${API_TIMEOUT_MS}ms`);
    this.name = "ApiTimeoutError";
  }
}

async function callApi(
  prompt: string,
  systemPrompt: string | undefined,
  options: GenerateAIOptions
): Promise<string> {
  const provider = providerForModel(options.model);

  if (!provider.isConfigured()) {
    throw new Error("No AI provider is configured");
  }

  const collect = (async () => {
    let text = "";

    for await (const chunk of provider.streamCompletion(
      [{ role: "user", content: prompt }],
      {
        ...(systemPrompt ? { systemPrompt } : {}),
        ...(options.maxTokens ? { maxTokens: options.maxTokens } : {}),
        model: options.vendorModel ?? resolveModelId(options.model),
      }
    )) {
      // The provider reports failures as an error chunk rather than throwing,
      // so it has to be turned back into one for the fallback to trigger.
      if (chunk.type === "error") {
        throw new Error(chunk.error ?? "The AI service returned an error");
      }
      if (chunk.type === "text" && chunk.text) text += chunk.text;
    }

    return text;
  })();

  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ApiTimeoutError()), API_TIMEOUT_MS);
  });

  try {
    const text = await Promise.race([collect, timeout]);
    if (!text.trim()) throw new Error("The AI service returned an empty reply");
    return text;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function withSearchContext(
  prompt: string,
  enabled: boolean
): Promise<string> {
  if (!enabled) return prompt;

  const context = formatSearchResults(await searchWeb(prompt));
  return context ? `${context}\n\n---\n\n${prompt}` : prompt;
}

export async function generateAI(
  prompt: string,
  systemPrompt?: string,
  options: GenerateAIOptions = {}
): Promise<GenerateAIResult> {
  try {
    const apiPrompt = await withSearchContext(
      prompt,
      options.useWebSearch === true
    );
    const text = await callApi(apiPrompt, systemPrompt, options);
    return { text, source: "api" };
  } catch (err) {
    console.error(
      "AI router falling back to the local model:",
      err instanceof Error ? err.message : err
    );

    if (options.requiresTools) {
      return { text: TOOLS_UNAVAILABLE_MESSAGE, source: "local" };
    }

    const localPrompt = await withSearchContext(
      prompt,
      options.useWebSearch === true && options.useWebSearchOnLocal === true
    );
    const text = await generateLocal(localPrompt, systemPrompt);
    return { text, source: "local" };
  }
}
