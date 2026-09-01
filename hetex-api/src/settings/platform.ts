// Hetex AI — platform configuration.
//
// Settings an administrator owns, not a user: which features exist at all, what
// the per-day ceilings are, what a fresh account starts with. User settings are
// clamped against this on read and on write, which is what makes "the admin
// turned voice off" show up as "Voice is currently unavailable" on every
// account rather than as a toggle that silently does nothing.
//
// One row, cached in process. Admin writes bust the cache.

import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "../db";

export const FEATURES = [
  "chat",
  "voice",
  "liveVoice",
  "imageAnalysis",
  "imageGeneration",
  "fileUploads",
  "memory",
  "projects",
  "library",
  "webSearch",
  "localAI",
  "integrations",
] as const;

export type Feature = (typeof FEATURES)[number];

const featureFlags = z.object(
  Object.fromEntries(FEATURES.map((f) => [f, z.boolean()])) as {
    [K in Feature]: z.ZodBoolean;
  }
);

export const platformConfigSchema = z.object({
  features: featureFlags.default({
    chat: true,
    voice: true,
    liveVoice: true,
    imageAnalysis: true,
    // No image-generation provider is implemented. The flag exists so enabling
    // it is a config change once one is, but it starts off and the route
    // refuses regardless of what a client sends.
    imageGeneration: false,
    fileUploads: true,
    memory: true,
    projects: true,
    library: true,
    webSearch: true,
    localAI: true,
    integrations: true,
  }),

  limits: z
    .object({
      /** 0 means no ceiling. */
      messagesPerDay: z.number().int().min(0).default(0),
      imageGenerationsPerDay: z.number().int().min(0).default(0),
      imageUploadsPerDay: z.number().int().min(0).default(0),
      voiceMinutesPerDay: z.number().int().min(0).default(0),
      maxUploadMb: z.number().int().min(1).max(100).default(5),
      maxAttachmentsPerMessage: z.number().int().min(1).max(20).default(10),
      maxStorageMb: z.number().int().min(0).default(0),
      maxProjects: z.number().int().min(0).default(0),
      maxMemoryEntries: z.number().int().min(1).max(500).default(60),
      maxOutputTokens: z.number().int().min(256).max(32000).default(8192),
    })
    .default({}),

  /** File types the upload path accepts. Enforced in the chat route. */
  allowedFileTypes: z
    .array(z.string().max(120))
    .default([
      "image/png",
      "image/jpeg",
      "image/gif",
      "image/webp",
      "application/pdf",
      "text/plain",
      "text/markdown",
      "text/csv",
      "application/json",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ]),

  /** What a brand-new account starts with, as a settings patch. */
  defaults: z
    .object({
      model: z.string().max(80).default("standard"),
      theme: z.enum(["light", "dark", "system", "amoled"]).default("system"),
      memoryEnabled: z.boolean().default(false),
      autoRouting: z.boolean().default(false),
    })
    .default({}),

  safety: z
    .object({
      /** Not a user setting and not an admin one either — it cannot be turned off. */
      protectionsEnabled: z.literal(true).default(true),
      crisisResourcesRegion: z.string().max(40).default("international"),
      blockedTopicsNote: z.string().max(500).default(""),
    })
    .default({}),

  plans: z
    .array(
      z.object({
        id: z.string().max(40),
        name: z.string().max(60),
        description: z.string().max(200).default(""),
        priceLabel: z.string().max(40).default("Free"),
        available: z.boolean().default(false),
      })
    )
    .default([
      {
        id: "free",
        name: "Free",
        description: "Everything in Hetex AI while it is in early access.",
        priceLabel: "Free",
        available: true,
      },
      {
        id: "plus",
        name: "Plus",
        description: "Higher limits and priority models. Not launched.",
        priceLabel: "Not priced",
        available: false,
      },
      {
        id: "pro",
        name: "Pro",
        description: "For heavy daily use. Not launched.",
        priceLabel: "Not priced",
        available: false,
      },
      {
        id: "business",
        name: "Business",
        description: "Shared workspaces and admin controls. Not launched.",
        priceLabel: "Not priced",
        available: false,
      },
    ]),

  /** No payment processor is connected. Set true only when one genuinely is. */
  billingConfigured: z.boolean().default(false),

  /**
   * Whether Settings names the vendor behind each hosted model.
   *
   * Off by default, because the assistant's own system prompt says it will not
   * discuss the underlying model or vendor, and a Settings screen naming them
   * would contradict that in the same product. Administrators always see the
   * real names in the admin dashboard regardless of this flag; turning it on
   * shows them to end users too.
   */
  revealProviderNames: z.boolean().default(false),
});

export type PlatformConfig = z.infer<typeof platformConfigSchema>;

export const platformConfigPatchSchema = z
  .object({
    features: featureFlags.partial().strict().optional(),
    limits: platformConfigSchema.shape.limits
      .removeDefault()
      .partial()
      .strict()
      .optional(),
    allowedFileTypes: platformConfigSchema.shape.allowedFileTypes.optional(),
    defaults: platformConfigSchema.shape.defaults
      .removeDefault()
      .partial()
      .strict()
      .optional(),
    safety: platformConfigSchema.shape.safety
      .removeDefault()
      .partial()
      .strict()
      .optional(),
    plans: platformConfigSchema.shape.plans.optional(),
    billingConfigured: z.boolean().optional(),
    revealProviderNames: z.boolean().optional(),
  })
  .strict();

export type PlatformConfigPatch = z.infer<typeof platformConfigPatchSchema>;

export function defaultPlatformConfig(): PlatformConfig {
  return platformConfigSchema.parse({});
}

export function mergePlatformConfig(
  base: PlatformConfig,
  patch: PlatformConfigPatch
): PlatformConfig {
  return {
    ...base,
    ...(patch.features ? { features: { ...base.features, ...patch.features } } : {}),
    ...(patch.limits ? { limits: { ...base.limits, ...patch.limits } } : {}),
    ...(patch.allowedFileTypes ? { allowedFileTypes: patch.allowedFileTypes } : {}),
    ...(patch.defaults ? { defaults: { ...base.defaults, ...patch.defaults } } : {}),
    ...(patch.safety ? { safety: { ...base.safety, ...patch.safety } } : {}),
    ...(patch.plans ? { plans: patch.plans } : {}),
    ...(patch.billingConfigured !== undefined
      ? { billingConfigured: patch.billingConfigured }
      : {}),
    ...(patch.revealProviderNames !== undefined
      ? { revealProviderNames: patch.revealProviderNames }
      : {}),
  };
}

const CONFIG_ROW_ID = "default";

let cache: { value: PlatformConfig; at: number } | null = null;
const CACHE_MS = 30_000;

/**
 * The live platform config.
 *
 * Cached because it is read on every chat request and every settings read. A
 * stale value for up to 30 seconds after an admin change is an acceptable trade
 * against a database round trip per message; `invalidatePlatformConfig` makes
 * the writing process itself immediate.
 */
export async function getPlatformConfig(): Promise<PlatformConfig> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;

  let value = defaultPlatformConfig();
  try {
    const row = await db.query.platformConfig.findFirst({
      where: eq(schema.platformConfig.id, CONFIG_ROW_ID),
    });
    if (row?.config) {
      // Parsed, not trusted: a row written by an older build may be missing
      // keys that exist now, and parse fills them from the defaults.
      const parsed = platformConfigSchema.safeParse(row.config);
      if (parsed.success) value = parsed.data;
    }
  } catch (err) {
    // A missing table (migration not yet applied) must not take chat down.
    console.error(
      "Falling back to default platform config:",
      err instanceof Error ? err.message : err
    );
  }

  cache = { value, at: Date.now() };
  return value;
}

export function invalidatePlatformConfig(): void {
  cache = null;
}

export async function savePlatformConfig(
  patch: PlatformConfigPatch
): Promise<PlatformConfig> {
  const next = mergePlatformConfig(await getPlatformConfig(), patch);

  await db
    .insert(schema.platformConfig)
    .values({ id: CONFIG_ROW_ID, config: next, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: schema.platformConfig.id,
      set: { config: next, updatedAt: new Date() },
    });

  cache = { value: next, at: Date.now() };
  return next;
}
