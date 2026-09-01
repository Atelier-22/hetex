import type { AIProvider } from "./provider.interface";
import { AnthropicProvider } from "./providers/anthropic.provider";
import { DeepSeekProvider } from "./providers/deepseek.provider";
import { LocalProvider } from "./providers/local.provider";

// Registry pattern: adding a provider means writing one new file and adding one
// line here. Nothing in the routes, services or UI needs to change — the model
// list the frontend renders is derived from this.
//
// Order is offer order. Hosted providers come first because they are more
// capable; Local AI is last but needs no key, so it is the one that is
// available on a server with nothing configured at all.
const providers: AIProvider[] = [
  new AnthropicProvider(),
  new DeepSeekProvider(),
  new LocalProvider(),
];

/** True for providers that send requests off this machine. */
export function isHostedProvider(id: string): boolean {
  return id !== "local";
}

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
      capabilities: p.capabilities,
      // The provider *id*, not its vendor name. Settings needs to know which
      // models are local and which leave the machine — that is a privacy fact,
      // not a vendor disclosure — while `displayName` stays server-side unless
      // the platform config opts into revealing it.
      provider: p.id,
      local: p.id === "local",
    }))
  );
}

/**
 * Provider status for the AI & Models screen.
 *
 * `vendor` is only populated when the caller has decided names may be shown —
 * an admin, or a platform that has opted in. Everyone else sees the neutral
 * label, matching what the assistant itself will say if asked.
 */
export function providerStatus(options: { revealNames?: boolean } = {}) {
  return providers.map((p) => ({
    id: p.id,
    label: p.id === "local" ? "Local AI" : "Hosted AI",
    vendor: options.revealNames ? p.displayName : null,
    configured: p.isConfigured(),
    local: p.id === "local",
    capabilities: p.capabilities,
    models: p.models.map((m) => ({
      value: m.id,
      label: m.label,
      description: m.description,
    })),
  }));
}

/**
 * Matches a stored preference against a provider's models.
 *
 * Accepts the vendor id as well as the public tier: accounts created before
 * tiers existed hold values like "claude-sonnet-4-6", and they should keep
 * working rather than silently falling back.
 */
function matches(
  model: string,
  entry: { id: string; modelId: string }
): boolean {
  return entry.id === model || entry.modelId === model;
}

/**
 * Which provider serves a given tier.
 *
 * Falls back to the first configured provider when the tier is unknown or its
 * provider has since been unconfigured — an account that picked a model whose
 * key was later removed keeps working rather than erroring on every message.
 */
export function providerForModel(model?: string): AIProvider {
  if (model) {
    const owner = configuredProviders().find((p) =>
      p.models.some((m) => matches(model, m))
    );
    if (owner) return owner;
  }
  return getProvider();
}

/**
 * The vendor model id for a stored tier.
 *
 * Undefined means "let the provider use its own default", which is what an
 * unrecognised value should do.
 */
export function resolveModelId(model?: string): string | undefined {
  if (!model) return undefined;
  for (const p of configuredProviders()) {
    const entry = p.models.find((m) => matches(model, m));
    if (entry) return entry.modelId;
  }
  return undefined;
}

export * from "./provider.interface";
