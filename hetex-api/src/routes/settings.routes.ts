import { Router } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import { requireAuth, asyncHandler } from "../auth/middleware";
import {
  NOTIFICATION_CATEGORIES,
  withDefaults,
} from "../services/notifications.service";

const NOTIFICATION_CATEGORY_IDS = NOTIFICATION_CATEGORIES.map((c) => c.id) as [
  string,
  ...string[],
];

export const settingsRouter = Router();

settingsRouter.use(requireAuth);

// Models the user is allowed to pick. Anything outside this list is rejected
// rather than passed through to the provider — an arbitrary string here would
// become a 400 from Anthropic at send time, long after the mistake was made.
export const ALLOWED_MODELS = [
  "claude-sonnet-4-6",
  "claude-opus-5",
] as const;

const notificationChannel = z.enum(["push", "email", "push_email", "off"]);

const patchSchema = z.object({
  theme: z.enum(["system", "light", "dark"]).optional(),
  accentColor: z.enum(["green", "blue", "violet", "amber", "rose"]).optional(),
  textSize: z.enum(["small", "medium", "large"]).optional(),
  assistantName: z.string().min(1).max(80).optional(),
  responseStyle: z.enum(["concise", "balanced", "detailed"]).optional(),
  model: z.enum(ALLOWED_MODELS).optional(),
  memoryEnabled: z.boolean().optional(),
  enterToSend: z.boolean().optional(),
  dictationEnabled: z.boolean().optional(),
  voiceName: z.string().max(120).nullable().optional(),
  voiceInputLang: z.string().max(35).nullable().optional(),

  language: z.string().min(2).max(35).optional(),
  launchAtLogin: z.boolean().optional(),

  // Only known categories, only known channels — an unrecognised key would sit
  // in jsonb forever and never be read.
  notificationPrefs: z
    .record(z.enum(NOTIFICATION_CATEGORY_IDS), notificationChannel)
    .optional(),

  customInstructions: z.string().max(4000).nullable().optional(),
  chatHistoryEnabled: z.boolean().optional(),
  trainingOptIn: z.boolean().optional(),
});

settingsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    let settings = await db.query.userSettings.findFirst({
      where: eq(schema.userSettings.userId, req.userId!),
    });

    if (!settings) {
      [settings] = await db
        .insert(schema.userSettings)
        .values({ userId: req.userId! })
        .returning();
    }

    // Stored prefs hold only what the user has changed; merging the defaults
    // here means the client never has to know what a default is.
    res.json({
      ...settings,
      notificationPrefs: withDefaults(settings.notificationPrefs),
    });
  })
);

/**
 * Static metadata the settings UI renders — category labels, channels, the
 * models on offer. Served from the backend so the two cannot drift apart.
 */
settingsRouter.get(
  "/meta",
  asyncHandler(async (_req, res) => {
    res.json({
      notificationCategories: NOTIFICATION_CATEGORIES,
      notificationChannels: [
        { value: "push", label: "Push" },
        { value: "email", label: "Email" },
        { value: "push_email", label: "Push and email" },
        { value: "off", label: "Off" },
      ],
      models: [
        {
          value: "claude-sonnet-4-6",
          label: "Sonnet 4.6",
          description: "Fast and capable. The default.",
        },
        {
          value: "claude-opus-5",
          label: "Opus 5",
          description:
            "Stronger on hard reasoning, and several times more expensive per message.",
        },
      ],
      // No translations exist yet; the list is what the interface would offer.
      languages: [
        { value: "auto", label: "Auto-detect" },
        { value: "en", label: "English" },
        { value: "sw", label: "Kiswahili" },
        { value: "fr", label: "Français" },
        { value: "ar", label: "العربية" },
      ],
    });
  })
);

settingsRouter.patch(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: parsed.error.issues[0]?.message ?? "Invalid settings" });
      return;
    }

    const existing = await db.query.userSettings.findFirst({
      where: eq(schema.userSettings.userId, req.userId!),
    });

    // jsonb is replaced wholesale on write, so a patch containing one category
    // would silently drop the rest. Merge onto what is already stored.
    const patch = {
      ...parsed.data,
      ...(parsed.data.notificationPrefs
        ? {
            notificationPrefs: {
              ...withDefaults(existing?.notificationPrefs),
              ...parsed.data.notificationPrefs,
            },
          }
        : {}),
      updatedAt: new Date(),
    };

    const [updated] = existing
      ? await db
          .update(schema.userSettings)
          .set(patch)
          .where(eq(schema.userSettings.userId, req.userId!))
          .returning()
      : await db
          .insert(schema.userSettings)
          .values({ userId: req.userId!, ...patch })
          .returning();

    res.json({
      ...updated,
      notificationPrefs: withDefaults(updated.notificationPrefs),
    });
  })
);
