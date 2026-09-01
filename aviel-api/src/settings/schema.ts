// Aviel AI — canonical user settings schema.
//
// This file is the single source of truth for what a setting is called, what
// values it may take, and what it defaults to. The database mapping, the API
// validation, the reset behaviour and the import/export format all derive from
// it, so a new setting is added here and nowhere else.
//
// Every value is validated server-side. Nothing here trusts the client.

import { z } from "zod";

/* -------------------------------------------------------------------------- */
/* Groups                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Profile. Identity fields live on `users`/`user_profiles` rather than in a
 * settings blob — they are queried on their own (username lookups, admin
 * listings) and a blob cannot be indexed usefully.
 */
export const profileSchema = z.object({
  fullName: z.string().max(120).nullable().default(null),
  displayName: z.string().max(80).nullable().default(null),
  username: z
    .string()
    .regex(/^[a-z0-9_.-]{3,32}$/i, "Use 3–32 letters, numbers, dot, dash or underscore")
    .nullable()
    .default(null),
  phone: z.string().max(32).nullable().default(null),
  country: z.string().max(2).nullable().default(null),
  timezone: z.string().max(64).nullable().default(null),
  preferredName: z.string().max(80).nullable().default(null),
  preferredGreeting: z.string().max(120).nullable().default(null),
  pronunciation: z.string().max(120).nullable().default(null),
  birthday: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .nullable()
    .default(null),
  occupation: z.string().max(120).nullable().default(null),
  interests: z.array(z.string().max(60)).max(20).default([]),
});

/**
 * Provider and model selection.
 *
 * `provider: "auto"` means "whichever configured provider owns the chosen
 * model". "local" pins every request to the on-device runtime, which is what
 * makes the privacy claim on the Privacy screen true rather than decorative.
 */
export const aiSchema = z.object({
  provider: z.string().max(40).default("auto"),
  defaultModel: z.string().max(80).default("standard"),
  fastModel: z.string().max(80).nullable().default(null),
  reasoningModel: z.string().max(80).nullable().default(null),
  visionModel: z.string().max(80).nullable().default(null),
  codingModel: z.string().max(80).nullable().default(null),
  /** Pick a model per message from the task rather than always using the default. */
  autoRouting: z.boolean().default(false),
  /** Answer from the on-device model when the hosted provider fails. */
  fallbackToLocal: z.boolean().default(true),
  /** Prefer a web lookup when the model supports one. */
  webSearch: z.boolean().default(true),
});

export const personalitySchema = z.object({
  persona: z
    .enum([
      "friendly",
      "professional",
      "casual",
      "academic",
      "creative",
      "direct",
      "supportive",
      "concise",
    ])
    .default("friendly"),
  responseStyle: z
    .enum(["concise", "balanced", "detailed", "very_detailed"])
    .default("balanced"),
  tone: z
    .enum(["warm", "neutral", "professional", "enthusiastic", "calm"])
    .default("neutral"),
  creativity: z.enum(["low", "medium", "high"]).default("medium"),
  formality: z.enum(["casual", "balanced", "formal"]).default("balanced"),
  assistantName: z.string().min(1).max(80).default("Aviel AI"),
  customInstructions: z.string().max(4000).nullable().default(null),
});

export const behaviorSchema = z.object({
  askFollowUps: z.boolean().default(false),
  explainAnswers: z.boolean().default(true),
  showReasoning: z.boolean().default(false),
  giveExamples: z.boolean().default(true),
  rememberContext: z.boolean().default(true),
  avoidRepetition: z.boolean().default(true),
  autoSummarizeLong: z.boolean().default(false),
  useConversationContext: z.boolean().default(true),
  citeSources: z.boolean().default(true),
  verifyInformation: z.boolean().default(true),
  admitUncertainty: z.boolean().default(true),
  useMarkdown: z.boolean().default(true),
  codeFormatting: z.boolean().default(true),
  useTables: z.boolean().default(true),
  useBullets: z.boolean().default(true),
  stepByStep: z.boolean().default(false),
});

export const memorySchema = z.object({
  enabled: z.boolean().default(false),
  /** Write new memories on its own, rather than only what you add by hand. */
  autoCapture: z.boolean().default(true),
  rememberPreferences: z.boolean().default(true),
  rememberPersonal: z.boolean().default(true),
  rememberProjects: z.boolean().default(true),
  rememberConversationContext: z.boolean().default(true),
  /** How many entries are injected into the system prompt. */
  maxEntriesInPrompt: z.number().int().min(1).max(60).default(20),
});

export const MEMORY_CATEGORIES = [
  "preferences",
  "projects",
  "personalization",
  "conversation",
] as const;
export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

export const conversationSchema = z.object({
  saveConversations: z.boolean().default(true),
  autoSave: z.boolean().default(true),
  /** 0 keeps conversations indefinitely. Anything else is swept server-side. */
  retentionDays: z.union([z.literal(0), z.literal(30), z.literal(90), z.literal(365)]).default(0),
  autoTitle: z.boolean().default(true),
  showTimestamps: z.boolean().default(true),
  showModelUsed: z.boolean().default(false),
  showUsage: z.boolean().default(false),
  streamResponses: z.boolean().default(true),
  autoScroll: z.boolean().default(true),
  sendKey: z.enum(["enter", "ctrl_enter"]).default("enter"),
  showTypingIndicator: z.boolean().default(true),
});

export const voiceSchema = z.object({
  /** Browser speech-synthesis voice name. Null follows the device default. */
  outputVoice: z.string().max(120).nullable().default(null),
  rate: z.number().min(0.5).max(2).default(1),
  pitch: z.number().min(0).max(2).default(1),
  volume: z.number().min(0).max(1).default(1),
  autoReadReplies: z.boolean().default(false),

  /** Whether the composer offers a microphone at all. */
  dictationEnabled: z.boolean().default(true),
  inputLanguage: z.string().max(35).default("en-US"),
  autoDetectInputLanguage: z.boolean().default(false),
  liveTranscription: z.boolean().default(true),
  showTranscript: z.boolean().default(true),
  editTranscript: z.boolean().default(true),
  autoSubmit: z.boolean().default(false),
  micMode: z.enum(["tap", "hold", "continuous"]).default("tap"),

  noiseReduction: z.boolean().default(true),
  audioQuality: z.enum(["standard", "high"]).default("standard"),
  soundEffects: z.boolean().default(true),
  hapticFeedback: z.boolean().default(true),
});

export const liveVoiceSchema = z.object({
  enabled: z.boolean().default(true),
  continuousListening: z.boolean().default(true),
  voiceActivityDetection: z.boolean().default(true),
  /** Talking over Aviel stops it speaking. */
  allowInterrupt: z.boolean().default(true),
  /** Aviel may start replying before you have stopped speaking. */
  allowAiInterruption: z.boolean().default(false),
  autoResponse: z.boolean().default(true),
  showTranscript: z.boolean().default(true),
  saveTranscript: z.boolean().default(true),
  /** No audio store exists, so this is refused server-side rather than honoured. */
  saveAudio: z.boolean().default(false),
  autoDeleteAudioDays: z.number().int().min(0).max(365).default(0),
  maxSessionMinutes: z.number().int().min(1).max(120).default(15),
});

export const imagesSchema = z.object({
  analysisEnabled: z.boolean().default(true),
  generationEnabled: z.boolean().default(false),
  autoAnalyzeUploads: z.boolean().default(true),
  askBeforeAnalyzing: z.boolean().default(false),
  saveUploads: z.boolean().default(true),
  saveGenerated: z.boolean().default(true),
  deleteAfterConversation: z.boolean().default(false),
  keepHistory: z.boolean().default(true),
  retentionDays: z.number().int().min(0).max(365).default(0),

  visionModel: z.string().max(80).nullable().default(null),
  ocr: z.boolean().default(false),
  screenshotAnalysis: z.boolean().default(true),
  documentImageAnalysis: z.boolean().default(true),

  generationModel: z.string().max(80).nullable().default(null),
  aspectRatio: z.enum(["1:1", "16:9", "9:16", "4:3", "3:2"]).default("1:1"),
  generationResolution: z.enum(["512", "768", "1024"]).default("1024"),
  generationQuality: z.enum(["draft", "standard", "high"]).default("standard"),
});

export const filesSchema = z.object({
  autoAnalyze: z.boolean().default(true),
  autoIndex: z.boolean().default(false),
  keepUploads: z.boolean().default(true),
  deleteAfterConversation: z.boolean().default(false),
  retentionDays: z.number().int().min(0).max(365).default(0),
  /** Only "database" is real today; the platform config reports what is in use. */
  storage: z.enum(["database", "cloud", "local"]).default("database"),
});

export const appearanceSchema = z.object({
  theme: z.enum(["light", "dark", "system", "amoled"]).default("system"),
  visualStyle: z.enum(["glass", "solid", "minimal"]).default("glass"),
  accent: z
    .enum(["green", "blue", "violet", "amber", "rose", "custom"])
    .default("green"),
  customAccent: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i, "Use a hex colour like #14b366")
    .nullable()
    .default(null),
  background: z
    .enum(["gradient", "static", "ambient", "minimal", "none"])
    .default("static"),
  animations: z.enum(["full", "reduced", "off"]).default("full"),
  messageDensity: z.enum(["compact", "comfortable", "spacious"]).default("comfortable"),
  bubbleStyle: z.enum(["rounded", "square", "minimal"]).default("rounded"),
  fontSize: z.enum(["small", "medium", "large", "xlarge"]).default("medium"),
  codeFontSize: z.enum(["small", "medium", "large"]).default("medium"),
  lineSpacing: z.enum(["tight", "normal", "relaxed"]).default("normal"),
  sidebar: z.enum(["expanded", "collapsed", "auto"]).default("expanded"),
});

export const languageSchema = z.object({
  /** Interface copy. English is the only translation that exists. */
  app: z.string().max(35).default("auto"),
  /** Passed to the model, so this one genuinely changes what comes back. */
  aiResponse: z.string().max(35).default("auto"),
  voiceInput: z.string().max(35).default("auto"),
  voiceOutput: z.string().max(35).default("auto"),
  autoDetect: z.boolean().default(true),
});

export const accessibilitySchema = z.object({
  largeText: z.boolean().default(false),
  extraLargeText: z.boolean().default(false),
  boldText: z.boolean().default(false),
  highContrast: z.boolean().default(false),
  reduceMotion: z.boolean().default(false),
  screenReaderHints: z.boolean().default(false),
  keyboardNavigation: z.boolean().default(true),
  voiceNavigation: z.boolean().default(false),
  captions: z.boolean().default(false),
  hapticFeedback: z.boolean().default(true),
  largerButtons: z.boolean().default(false),
});

export const NOTIFICATION_CHANNELS = ["push", "email", "push_email", "off"] as const;

export const notificationsSchema = z.object({
  /** Per-category channel. Categories come from the notifications service. */
  categories: z.record(z.enum(NOTIFICATION_CHANNELS)).default({}),
  sound: z.boolean().default(true),
  quietHoursEnabled: z.boolean().default(false),
  /** 24-hour local clock, "HH:MM". */
  quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/).default("22:00"),
  quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).default("07:00"),
  /** Browser Notification API, for a reply that finishes while the tab is hidden. */
  desktopCompletion: z.boolean().default(false),
});

export const privacySchema = z.object({
  saveVoiceRecordings: z.boolean().default(false),
  saveVoiceTranscripts: z.boolean().default(true),
  trainingOptIn: z.boolean().default(false),
  /** Warn before a message leaves the machine for a hosted provider. */
  showProcessingLocation: z.boolean().default(true),
  /** Refuse to send anything to a hosted provider; local runtime only. */
  localOnly: z.boolean().default(false),
});

export const securitySchema = z.object({
  loginAlerts: z.boolean().default(true),
  securityNotifications: z.boolean().default(true),
  /** 0 disables the idle timeout. */
  sessionTimeoutMinutes: z.number().int().min(0).max(1440).default(0),
});

/**
 * Safety.
 *
 * There is no switch here that turns protection off, and there never will be —
 * the only thing a user picks is how a refusal is worded. `crisisResources`
 * defaults on and can be turned off only in the sense of not repeating a
 * hotline in every message; the protection itself is not user-controlled.
 */
export const safetySchema = z.object({
  responseStyle: z.enum(["gentle", "direct", "emergency"]).default("gentle"),
  showCrisisResources: z.boolean().default(true),
});

export const projectsSchema = z.object({
  autoSave: z.boolean().default(true),
  projectMemory: z.boolean().default(true),
  useProjectContext: z.boolean().default(true),
  fileIndexing: z.boolean().default(false),
  notifications: z.boolean().default(true),
  defaultModel: z.string().max(80).nullable().default(null),
  defaultInstructions: z.string().max(4000).nullable().default(null),
  defaultResponseStyle: z
    .enum(["inherit", "concise", "balanced", "detailed", "very_detailed"])
    .default("inherit"),
});

export const librarySchema = z.object({
  autoSaveChats: z.boolean().default(true),
  autoSaveGeneratedFiles: z.boolean().default(true),
  autoSaveGeneratedImages: z.boolean().default(true),
  sort: z.enum(["newest", "oldest", "alphabetical", "most_used"]).default("newest"),
});

export const offlineSchema = z.object({
  /** Keep the last conversations readable with no connection. */
  cacheConversations: z.boolean().default(true),
  cacheLimit: z.number().int().min(0).max(200).default(20),
  downloadOverWifiOnly: z.boolean().default(true),
  allowMobileData: z.boolean().default(false),
  autoUpdateModels: z.boolean().default(false),
  preferLocalWhenOffline: z.boolean().default(true),
});

export const advancedSchema = z.object({
  temperature: z.number().min(0).max(2).default(1),
  maxOutputTokens: z.number().int().min(256).max(32000).default(4096),
  streaming: z.boolean().default(true),
  debugMode: z.boolean().default(false),
  developerMode: z.boolean().default(false),
  experimentalFeatures: z.boolean().default(false),
  fallbackModel: z.string().max(80).nullable().default(null),
  /** Meaningless in a browser. Stored so a desktop build inherits the choice. */
  launchAtLogin: z.boolean().default(false),
});

/* -------------------------------------------------------------------------- */
/* The whole document                                                         */
/* -------------------------------------------------------------------------- */

export const userSettingsSchema = z.object({
  profile: profileSchema.default({}),
  ai: aiSchema.default({}),
  personality: personalitySchema.default({}),
  behavior: behaviorSchema.default({}),
  memory: memorySchema.default({}),
  conversation: conversationSchema.default({}),
  voice: voiceSchema.default({}),
  liveVoice: liveVoiceSchema.default({}),
  images: imagesSchema.default({}),
  files: filesSchema.default({}),
  appearance: appearanceSchema.default({}),
  language: languageSchema.default({}),
  accessibility: accessibilitySchema.default({}),
  notifications: notificationsSchema.default({}),
  privacy: privacySchema.default({}),
  security: securitySchema.default({}),
  safety: safetySchema.default({}),
  projects: projectsSchema.default({}),
  library: librarySchema.default({}),
  offline: offlineSchema.default({}),
  advanced: advancedSchema.default({}),
});

export type UserSettings = z.infer<typeof userSettingsSchema>;
export type SettingsGroup = keyof UserSettings;

/** Every group name, in the order the API and the UI enumerate them. */
export const SETTINGS_GROUPS = Object.keys(
  userSettingsSchema.shape
) as SettingsGroup[];

/** A fresh copy of the defaults. Never share the object — callers mutate. */
export function defaultSettings(): UserSettings {
  return userSettingsSchema.parse({});
}

/* -------------------------------------------------------------------------- */
/* Patching                                                                   */
/* -------------------------------------------------------------------------- */

const groupPartials = {
  profile: profileSchema.partial(),
  ai: aiSchema.partial(),
  personality: personalitySchema.partial(),
  behavior: behaviorSchema.partial(),
  memory: memorySchema.partial(),
  conversation: conversationSchema.partial(),
  voice: voiceSchema.partial(),
  liveVoice: liveVoiceSchema.partial(),
  images: imagesSchema.partial(),
  files: filesSchema.partial(),
  appearance: appearanceSchema.partial(),
  language: languageSchema.partial(),
  accessibility: accessibilitySchema.partial(),
  notifications: notificationsSchema.partial(),
  privacy: privacySchema.partial(),
  security: securitySchema.partial(),
  safety: safetySchema.partial(),
  projects: projectsSchema.partial(),
  library: librarySchema.partial(),
  offline: offlineSchema.partial(),
  advanced: advancedSchema.partial(),
} as const;

/**
 * A PATCH body: any subset of groups, any subset of keys within them.
 *
 * `.strict()` at both levels is deliberate — an unknown key is a client bug or
 * an attempt to smuggle a field past validation, and silently dropping it makes
 * both harder to notice.
 */
export const settingsPatchSchema = z
  .object(
    Object.fromEntries(
      Object.entries(groupPartials).map(([k, v]) => [k, v.strict().optional()])
    ) as {
      [K in SettingsGroup]: z.ZodOptional<z.ZodObject<any, "strict">>;
    }
  )
  .strict();

export type SettingsPatch = {
  [K in SettingsGroup]?: Partial<UserSettings[K]>;
};

/**
 * Merge a validated patch onto a settings document.
 *
 * One level deep, which is exactly how deep the schema goes. Groups absent from
 * the patch are untouched; keys absent within a group are untouched.
 */
export function mergeSettings(
  base: UserSettings,
  patch: SettingsPatch
): UserSettings {
  const next = { ...base } as UserSettings;

  for (const group of SETTINGS_GROUPS) {
    const incoming = patch[group];
    if (!incoming) continue;
    next[group] = { ...(base[group] as object), ...(incoming as object) } as never;
  }

  return next;
}

/** Replace one group with its defaults, leaving every other group alone. */
export function resetGroup(
  settings: UserSettings,
  group: SettingsGroup
): UserSettings {
  const defaults = defaultSettings();
  return { ...settings, [group]: defaults[group] };
}

/* -------------------------------------------------------------------------- */
/* Import                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Fields an imported file may never set.
 *
 * Import is a file the user supplies, so it is exactly the wrong place to let
 * someone hand themselves a raised token ceiling or a username that belongs to
 * somebody else. These are dropped before validation rather than rejected, so
 * importing a file exported from another account still restores everything that
 * is safe to restore.
 */
const IMPORT_BLOCKED: Partial<Record<SettingsGroup, string[]>> = {
  profile: ["username", "phone"],
  advanced: ["maxOutputTokens", "developerMode"],
};

export type ImportResult = {
  patch: SettingsPatch;
  /** "group.key" for every field the file contained but was not allowed to set. */
  skipped: string[];
};

/**
 * Turn an arbitrary parsed JSON document into a patch that is safe to apply.
 *
 * Unknown groups and unknown keys are dropped rather than failing the whole
 * import — a file exported from a newer build should still restore what this
 * build understands.
 */
export function sanitizeImport(input: unknown): ImportResult {
  const skipped: string[] = [];
  const patch: Record<string, Record<string, unknown>> = {};

  if (!input || typeof input !== "object") return { patch: {}, skipped };

  // Accept both a bare settings document and the wrapper produced by export.
  const root =
    "settings" in (input as Record<string, unknown>) &&
    typeof (input as Record<string, unknown>).settings === "object"
      ? ((input as Record<string, unknown>).settings as Record<string, unknown>)
      : (input as Record<string, unknown>);

  for (const group of SETTINGS_GROUPS) {
    const incoming = root[group];
    if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
      continue;
    }

    const blocked = IMPORT_BLOCKED[group] ?? [];
    const allowed: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(incoming as object)) {
      if (blocked.includes(key)) {
        skipped.push(`${group}.${key}`);
        continue;
      }
      allowed[key] = value;
    }

    const parsed = groupPartials[group].strip().safeParse(allowed);
    if (!parsed.success) {
      // Salvage the valid keys instead of discarding the group wholesale.
      const bad = new Set(parsed.error.issues.map((i) => String(i.path[0])));
      for (const key of bad) skipped.push(`${group}.${key}`);
      const retry = Object.fromEntries(
        Object.entries(allowed).filter(([k]) => !bad.has(k))
      );
      const second = groupPartials[group].strip().safeParse(retry);
      if (second.success && Object.keys(second.data).length > 0) {
        patch[group] = second.data as Record<string, unknown>;
      }
      continue;
    }

    if (Object.keys(parsed.data).length > 0) {
      patch[group] = parsed.data as Record<string, unknown>;
    }
  }

  return { patch: patch as SettingsPatch, skipped };
}
