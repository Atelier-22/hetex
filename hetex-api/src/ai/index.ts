import type { AIProvider } from "./provider.interface";
import { AnthropicProvider } from "./providers/anthropic.provider";
import { DeepSeekProvider } from "./providers/deepseek.provider";

// Registry pattern: adding a provider means writing one new file and adding one
// line here. Nothing in the routes, services or UI needs to change — the model
// list the frontend renders is derived from this.
const providers: AIProvider[] = [
  new AnthropicProvider(),
  new DeepSeekProvider(),
];

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

/** Only providers whose key is actually present. */
export function configuredProviders(): AIProvider[] {
  return providers.filter((p) => p.isConfigured());
}

/**
 * The models a user may choose from, in offer order.
 *
 * Derived from whichever providers are configured, so removing a key removes
 * its models from Settings rather than leaving choices that fail on send.
 */
export function availableModels() {
  return configuredProviders().flatMap((p) =>
    p.models.map((m) => ({
      value: m.id,
      label: m.label,
      description: m.description,
      // Deliberately no provider name: the UI presents tiers by capability and
      // names no vendor.
      capabilities: p.capabilities,
    }))
  );
}

/**
 * Which provider serves a given model.
 *
 * Falls back to the first configured provider when the model is unknown or its
 * provider has since been unconfigured — an account that picked a model whose
 * key was later removed keeps working rather than erroring on every message.
 */
export function providerForModel(model?: string): AIProvider {
  if (model) {
    const owner = configuredProviders().find((p) =>
      p.models.some((m) => m.id === model)
    );
    if (owner) return owner;
  }
  return getProvider();
}

export * from "./provider.interface";
