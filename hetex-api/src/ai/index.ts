import type { AIProvider } from "./provider.interface";
import { AnthropicProvider } from "./providers/anthropic.provider";

// Registry pattern: adding a new provider means writing one new file and
// adding one line here. Nothing else in the app needs to change.
const providers: AIProvider[] = [new AnthropicProvider()];

export function getProvider(id?: string): AIProvider {
  const provider = id
    ? providers.find((p) => p.id === id)
    : providers.find((p) => p.isConfigured()) ?? providers[0];

  if (!provider) {
    throw new Error(`No AI provider found for id: ${id}`);
  }
  return provider;
}

export function listProviders(): AIProvider[] {
  return providers;
}

export * from "./provider.interface";
