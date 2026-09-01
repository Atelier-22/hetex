import { Router } from "express";
import { z } from "zod";
import { requireAuth, asyncHandler } from "../auth/middleware";
import { NOTIFICATION_CATEGORIES } from "../services/notifications.service";
import { availableModels, providerStatus } from "../ai";
import { getLocalRuntimeStatus } from "../ai/local-runtime";
import {
  SETTINGS_GROUPS,
  defaultSettings,
  sanitizeImport,
  settingsPatchSchema,
  userSettingsSchema,
  MEMORY_CATEGORIES,
  type SettingsGroup,
} from "../settings/schema";
import {
  loadSettings,
  resetSettings,
  saveSettings,
  UsernameTakenError,
} from "../settings/store";
import { getPlatformConfig } from "../settings/platform";
import { limitStates } from "../services/limits.service";
import { sweepUserInBackground } from "../services/retention.service";
import { isAdminEmail } from "../auth/admin";
import { APP_VERSION, BUILD_ID } from "../version";

export const settingsRouter = Router();

settingsRouter.use(requireAuth);

/** Groups whose retention numbers a sweep should act on immediately. */
const RETENTION_GROUPS: SettingsGroup[] = ["conversation", "images", "files"];

/* -------------------------------------------------------------------------- */
/* Read                                                                       */
/* -------------------------------------------------------------------------- */

settingsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json(await loadSettings(req.userId!));
  })
);

/**
 * Everything the settings UI needs that is not a user preference: which models
 * exist, which features the platform has enabled, what the limits are, what the
 * runtime can actually do.
 *
 * Served from the backend so the two cannot drift apart — a control the server
 * would refuse is never rendered as available.
 */
settingsRouter.get(
  "/meta",
  asyncHandler(async (req, res) => {
    const config = await getPlatformConfig();

    // Vendor names are an admin-only disclosure unless the platform opts in.
    // The assistant's own prompt refuses to name the model provider, and a
    // settings screen contradicting that in the same product would be worse
    // than saying nothing.
    const revealNames =
      config.revealProviderNames || isAdminEmail(req.userEmail ?? "");

    const [local, limits] = await Promise.all([
      getLocalRuntimeStatus(),
      limitStates(req.userId!),
    ]);

    res.json({
      version: APP_VERSION,
      build: BUILD_ID,

      models: availableModels(),
      providers: providerStatus({ revealNames }),

      localAI: {
        runtime: local.runtime,
        available: local.available,
        manageable: local.manageable,
        version: local.version,
        modelCount: local.models.length,
        requirement: local.requirement,
      },

      notificationCategories: NOTIFICATION_CATEGORIES,
      notificationChannels: [
        { value: "push", label: "Push" },
        { value: "email", label: "Email" },
        { value: "push_email", label: "Push and email" },
        { value: "off", label: "Off" },
      ],
      // Delivery is not built. Preferences are stored and enforced by the
      // permission check every future sender has to pass.
      notificationsDeliverable: false,

      memoryCategories: MEMORY_CATEGORIES,

      // Interface copy exists only in English. AI response language is a
      // different matter — that one genuinely works, because it is passed to
      // the model rather than used to look up a translation.
      interfaceLanguages: [{ value: "auto", label: "Auto-detect" }, { value: "en", label: "English" }],
      interfaceTranslationsAvailable: false,
      aiLanguages: [
        { value: "auto", label: "Match my message" },
        { value: "en", label: "English" },
        { value: "sw", label: "Kiswahili" },
        { value: "lg", label: "Luganda" },
        { value: "fr", label: "Français" },
        { value: "ar", label: "العربية" },
        { value: "es", label: "Español" },
        { value: "pt", label: "Português" },
        { value: "de", label: "Deutsch" },
        { value: "hi", label: "हिन्दी" },
        { value: "zh", label: "中文" },
      ],

      features: config.features,
      limits: config.limits,
      allowedFileTypes: config.allowedFileTypes,
      usage: limits,

      plans: config.plans,
      billingConfigured: config.billingConfigured,

      // Stated plainly so the Privacy screen can be specific rather than vague.
      capabilities: {
        imageGeneration: false,
        imageGenerationReason:
          "No image generation provider is connected to this server.",
        voiceServerSide: false,
        voiceServerSideReason:
          "Speech recognition and speech synthesis run in your browser. No audio is sent to Hetex.",
        audioStorage: false,
        audioStorageReason: "There is no audio store, so recordings cannot be kept.",
        twoFactor: true,
        passkeys: false,
        passkeysReason: "WebAuthn is not implemented on this server.",
        biometrics: false,
        biometricsReason:
          "A browser cannot read a fingerprint or face directly. That would need passkeys.",
        emailDelivery: false,
        emailDeliveryReason: "No mail transport is configured.",
        pushDelivery: false,
        pushDeliveryReason: "No push service is configured.",
        fileTextExtraction: false,
        fileTextExtractionReason:
          "Documents are stored and listed but their text is not read yet. Images are analysed.",
      },

      groups: SETTINGS_GROUPS,
      defaults: defaultSettings(),
    });
  })
);

/* -------------------------------------------------------------------------- */
/* Write                                                                      */
/* -------------------------------------------------------------------------- */

settingsRouter.patch(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = settingsPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      res.status(400).json({
        error: issue?.message ?? "Invalid settings",
        path: issue?.path.join("."),
      });
      return;
    }

    // A model has to exist before it can be selected. Validating this in the
    // schema is not possible — the list depends on which keys are configured at
    // this moment — so it is checked here, for every field that names a model.
    const allowed = new Set(availableModels().map((m) => m.value));

    const modelReferences: [SettingsGroup, string][] = [
      ["ai", "defaultModel"],
      ["ai", "fastModel"],
      ["ai", "reasoningModel"],
      ["ai", "visionModel"],
      ["ai", "codingModel"],
      ["images", "visionModel"],
      ["images", "generationModel"],
      ["projects", "defaultModel"],
      ["advanced", "fallbackModel"],
    ];

    for (const [group, key] of modelReferences) {
      const value = (parsed.data[group] as Record<string, unknown> | undefined)?.[
        key
      ];
      if (typeof value === "string" && value && !allowed.has(value)) {
        res.status(400).json({
          error: "That model isn't available on this server.",
          path: `${group}.${key}`,
        });
        return;
      }
    }

    try {
      const settings = await saveSettings(req.userId!, parsed.data);

      // Changing a retention period should take effect now, not at the next
      // scheduled sweep — otherwise "delete after 30 days" appears to do
      // nothing for up to six hours.
      if (RETENTION_GROUPS.some((g) => g in parsed.data)) {
        sweepUserInBackground(req.userId!);
      }

      res.json(settings);
    } catch (err) {
      if (err instanceof UsernameTakenError) {
        res.status(409).json({ error: err.message, path: "profile.username" });
        return;
      }
      throw err;
    }
  })
);

const resetSchema = z.object({
  group: z
    .string()
    .refine((g): g is SettingsGroup => SETTINGS_GROUPS.includes(g as SettingsGroup), {
      message: "Unknown settings section",
    })
    .optional(),
});

/**
 * Reset one section, or all of them.
 *
 * Preferences only. Conversations, files, projects, memory and the account are
 * untouched — deleting data is a separate, separately confirmed action.
 */
settingsRouter.post(
  "/reset",
  asyncHandler(async (req, res) => {
    const parsed = resetSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
      return;
    }

    const settings = await resetSettings(req.userId!, parsed.data.group);
    res.json(settings);
  })
);

/* -------------------------------------------------------------------------- */
/* Portability                                                                */
/* -------------------------------------------------------------------------- */

settingsRouter.get(
  "/export",
  asyncHandler(async (req, res) => {
    const settings = await loadSettings(req.userId!);

    // Identity is deliberately not exported. A settings file is something
    // people paste into issues and share with support; a phone number and date
    // of birth do not belong in one.
    const { profile, ...rest } = settings;

    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="hetex-settings-${new Date()
        .toISOString()
        .slice(0, 10)}.json"`
    );
    res.json({
      kind: "hetex.settings",
      version: 1,
      app: APP_VERSION,
      exportedAt: new Date().toISOString(),
      settings: {
        ...rest,
        profile: {
          preferredName: profile.preferredName,
          preferredGreeting: profile.preferredGreeting,
          occupation: profile.occupation,
          interests: profile.interests,
        },
      },
    });
  })
);

settingsRouter.post(
  "/import",
  asyncHandler(async (req, res) => {
    const { patch, skipped } = sanitizeImport(req.body);

    if (Object.keys(patch).length === 0) {
      res.status(400).json({
        error:
          "That file contained no settings this version recognises.",
        skipped,
      });
      return;
    }

    // Re-validated through the same path as a normal PATCH. An import is a
    // user-supplied file and gets no shortcut past validation.
    const parsed = settingsPatchSchema.safeParse(patch);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message ?? "That settings file is not valid",
        skipped,
      });
      return;
    }

    // A file from a server with different providers would otherwise pin an
    // unusable model. Drop the reference rather than rejecting the import.
    const allowed = new Set(availableModels().map((m) => m.value));
    for (const [group, key] of [
      ["ai", "defaultModel"],
      ["ai", "fastModel"],
      ["ai", "reasoningModel"],
      ["ai", "visionModel"],
      ["ai", "codingModel"],
      ["images", "visionModel"],
      ["images", "generationModel"],
      ["projects", "defaultModel"],
      ["advanced", "fallbackModel"],
    ] as [SettingsGroup, string][]) {
      const bag = parsed.data[group] as Record<string, unknown> | undefined;
      if (!bag) continue;
      const value = bag[key];
      if (typeof value === "string" && value && !allowed.has(value)) {
        delete bag[key];
        skipped.push(`${group}.${key}`);
      }
    }

    const settings = await saveSettings(req.userId!, parsed.data);
    if (RETENTION_GROUPS.some((g) => g in parsed.data)) {
      sweepUserInBackground(req.userId!);
    }

    res.json({
      settings,
      imported: Object.keys(parsed.data),
      skipped,
    });
  })
);

/** The shape of the document, for a client that wants to render it generically. */
settingsRouter.get("/schema", (_req, res) => {
  res.json({
    groups: SETTINGS_GROUPS,
    defaults: defaultSettings(),
    keys: Object.fromEntries(
      SETTINGS_GROUPS.map((g) => [
        g,
        Object.keys(
          (
            userSettingsSchema.shape[g] as z.ZodDefault<z.ZodObject<z.ZodRawShape>>
          ).removeDefault().shape
        ),
      ])
    ),
  });
});
