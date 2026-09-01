// Aviel AI — settings persistence.
//
// Reading and writing the settings document, and reconciling it with the two
// places settings actually live:
//
//   * scalar columns on user_settings, which other parts of the system read and
//     the admin dashboard aggregates over;
//   * one jsonb column per group, for preferences only this document reads.
//
// Callers see one nested `UserSettings` object and never touch either shape.

import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import {
  defaultSettings,
  mergeSettings,
  resetGroup,
  userSettingsSchema,
  type SettingsGroup,
  type SettingsPatch,
  type UserSettings,
} from "./schema";
import { getPlatformConfig } from "./platform";
import { clampToPlatform } from "./clamp";
import { withDefaults } from "../services/notifications.service";

export { clampToPlatform };

type SettingsRow = typeof schema.userSettings.$inferSelect;
type ProfileRow = typeof schema.userProfiles.$inferSelect;

/* -------------------------------------------------------------------------- */
/* Column <-> group mapping                                                   */
/* -------------------------------------------------------------------------- */

/** Which jsonb column backs each group. Groups absent here have no blob. */
const GROUP_COLUMN: Partial<Record<SettingsGroup, keyof SettingsRow>> = {
  ai: "aiPrefs",
  personality: "personality",
  behavior: "behavior",
  memory: "memoryPrefs",
  conversation: "conversationPrefs",
  voice: "voicePrefs",
  liveVoice: "liveVoicePrefs",
  images: "imagePrefs",
  files: "filePrefs",
  appearance: "appearance",
  language: "languagePrefs",
  accessibility: "accessibility",
  notifications: "notificationSettings",
  privacy: "privacyPrefs",
  security: "securityPrefs",
  safety: "safetyPrefs",
  projects: "projectPrefs",
  library: "libraryPrefs",
  offline: "offlinePrefs",
  advanced: "advancedPrefs",
};

/**
 * Settings that also live in a scalar column.
 *
 * The column is authoritative on read, because that is what the chat service
 * and the admin queries look at — if the two ever disagree, the value those
 * read is the one the user is actually getting, so it is the one to show.
 */
const SCALAR_MIRRORS: {
  group: SettingsGroup;
  key: string;
  column: keyof SettingsRow;
  /** column value -> settings value */
  read: (v: unknown) => unknown;
  /** settings value -> column value */
  write: (v: unknown) => unknown;
}[] = [
  { group: "appearance", key: "theme", column: "theme", read: (v) => v, write: (v) => v },
  { group: "appearance", key: "accent", column: "accentColor", read: (v) => v, write: (v) => v },
  { group: "appearance", key: "fontSize", column: "textSize", read: (v) => v, write: (v) => v },
  { group: "personality", key: "assistantName", column: "assistantName", read: (v) => v, write: (v) => v },
  { group: "personality", key: "responseStyle", column: "responseStyle", read: (v) => v, write: (v) => v },
  { group: "personality", key: "customInstructions", column: "customInstructions", read: (v) => v, write: (v) => v },
  { group: "ai", key: "defaultModel", column: "model", read: (v) => v, write: (v) => v },
  { group: "memory", key: "enabled", column: "memoryEnabled", read: (v) => v, write: (v) => v },
  {
    group: "conversation",
    key: "sendKey",
    column: "enterToSend",
    read: (v) => (v === false ? "ctrl_enter" : "enter"),
    write: (v) => v === "enter",
  },
  { group: "conversation", key: "saveConversations", column: "chatHistoryEnabled", read: (v) => v, write: (v) => v },
  { group: "voice", key: "outputVoice", column: "voiceName", read: (v) => v, write: (v) => v },
  {
    group: "voice",
    key: "inputLanguage",
    column: "voiceInputLang",
    read: (v) => v ?? "en-US",
    write: (v) => v,
  },
  { group: "voice", key: "dictationEnabled", column: "dictationEnabled", read: (v) => v, write: (v) => v },
  { group: "language", key: "app", column: "language", read: (v) => v, write: (v) => v },
  { group: "privacy", key: "trainingOptIn", column: "trainingOptIn", read: (v) => v, write: (v) => v },
  { group: "advanced", key: "launchAtLogin", column: "launchAtLogin", read: (v) => v, write: (v) => v },
];

/** Fields on user_profiles, which is a table rather than a blob. */
const PROFILE_COLUMNS = [
  "fullName",
  "username",
  "phone",
  "country",
  "timezone",
  "preferredName",
  "preferredGreeting",
  "pronunciation",
  "birthday",
  "occupation",
  "interests",
] as const;

/* -------------------------------------------------------------------------- */
/* Read                                                                       */
/* -------------------------------------------------------------------------- */

function rowToSettings(
  row: SettingsRow | undefined,
  profile: ProfileRow | undefined,
  displayName: string | null
): UserSettings {
  const raw: Record<string, Record<string, unknown>> = {};

  for (const [group, column] of Object.entries(GROUP_COLUMN) as [
    SettingsGroup,
    keyof SettingsRow,
  ][]) {
    const blob = row?.[column];
    raw[group] =
      blob && typeof blob === "object" && !Array.isArray(blob)
        ? { ...(blob as Record<string, unknown>) }
        : {};
  }

  // Scalar columns win over the blob — see SCALAR_MIRRORS.
  if (row) {
    for (const m of SCALAR_MIRRORS) {
      const value = row[m.column];
      if (value === undefined) continue;
      raw[m.group] = { ...raw[m.group], [m.key]: m.read(value) };
    }

    raw.notifications = {
      ...raw.notifications,
      categories: withDefaults(row.notificationPrefs),
    };
  } else {
    raw.notifications = { ...raw.notifications, categories: withDefaults(null) };
  }

  raw.profile = {
    displayName,
    ...Object.fromEntries(
      PROFILE_COLUMNS.map((k) => [k, profile ? profile[k] : undefined]).filter(
        ([, v]) => v !== undefined
      )
    ),
  };

  // parse rather than cast: a row written by an older build is missing keys
  // that exist now, and a value that is no longer valid (a model tier that was
  // removed) must not propagate into the response.
  const parsed = userSettingsSchema.safeParse(raw);
  if (parsed.success) return parsed.data;

  // One bad group should not cost the user every other setting, so groups are
  // retried individually and only the broken ones fall back to defaults.
  const fallback = defaultSettings();
  for (const group of Object.keys(fallback) as SettingsGroup[]) {
    const attempt = userSettingsSchema.shape[group].safeParse(raw[group] ?? {});
    if (attempt.success) fallback[group] = attempt.data as never;
  }
  return fallback;
}

/**
 * The settings document for an account.
 *
 * A read never writes: an account with no row yet gets the schema defaults
 * folded with whatever the administrator has set as the defaults for new
 * accounts, and the row appears on the first save.
 */
export async function loadSettings(userId: string): Promise<UserSettings> {
  const [row, profile, account, config] = await Promise.all([
    db.query.userSettings.findFirst({
      where: eq(schema.userSettings.userId, userId),
    }),
    db.query.userProfiles.findFirst({
      where: eq(schema.userProfiles.userId, userId),
    }),
    db.query.users.findFirst({
      where: eq(schema.users.id, userId),
      columns: { displayName: true },
    }),
    getPlatformConfig(),
  ]);

  let settings = rowToSettings(row, profile, account?.displayName ?? null);

  if (!row) {
    // A brand-new account inherits the admin's chosen defaults.
    settings = mergeSettings(settings, {
      ai: { defaultModel: config.defaults.model, autoRouting: config.defaults.autoRouting },
      appearance: { theme: config.defaults.theme },
      memory: { enabled: config.defaults.memoryEnabled },
    });
  }

  return clampToPlatform(settings, config);
}

/* -------------------------------------------------------------------------- */
/* Write                                                                      */
/* -------------------------------------------------------------------------- */

export class UsernameTakenError extends Error {
  constructor() {
    super("That username is already taken");
    this.name = "UsernameTakenError";
  }
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "23505"
  );
}

/**
 * Apply a validated patch and return the whole document.
 *
 * The merge happens against the stored document, not against whatever the
 * client believed was stored — two tabs editing different sections cannot
 * clobber each other, because each PATCH only carries the keys it changed.
 */
export async function saveSettings(
  userId: string,
  patch: SettingsPatch
): Promise<UserSettings> {
  const config = await getPlatformConfig();
  const current = await loadSettings(userId);
  const merged = clampToPlatform(mergeSettings(current, patch), config);

  const columnPatch: Record<string, unknown> = { updatedAt: new Date() };

  // Group blobs: written whole, from the merged document, so a blob can never
  // drift from what a read would return.
  for (const [group, column] of Object.entries(GROUP_COLUMN) as [
    SettingsGroup,
    keyof SettingsRow,
  ][]) {
    if (!patch[group]) continue;
    const value = { ...(merged[group] as Record<string, unknown>) };
    // notifications.categories has its own column; keeping a copy in the blob
    // would give it two homes and one of them would go stale.
    if (group === "notifications") delete value.categories;
    columnPatch[column as string] = value;
  }

  for (const m of SCALAR_MIRRORS) {
    if (!patch[m.group]) continue;
    if (!(m.key in (patch[m.group] as object))) continue;
    columnPatch[m.column as string] = m.write(
      (merged[m.group] as Record<string, unknown>)[m.key]
    );
  }

  if (patch.notifications?.categories) {
    columnPatch.notificationPrefs = merged.notifications.categories;
  }

  const hasSettingsWrite = Object.keys(columnPatch).length > 1;

  if (hasSettingsWrite) {
    const existing = await db.query.userSettings.findFirst({
      where: eq(schema.userSettings.userId, userId),
      columns: { id: true },
    });

    if (existing) {
      await db
        .update(schema.userSettings)
        .set(columnPatch)
        .where(eq(schema.userSettings.userId, userId));
    } else {
      await db
        .insert(schema.userSettings)
        .values({ userId, ...columnPatch })
        .onConflictDoUpdate({
          target: schema.userSettings.userId,
          set: columnPatch,
        });
    }
  }

  if (patch.profile) {
    await saveProfile(userId, patch.profile, merged);
  }

  return merged;
}

async function saveProfile(
  userId: string,
  patch: Partial<UserSettings["profile"]>,
  merged: UserSettings
): Promise<void> {
  // displayName is on `users`, because the session and every listing read it
  // from there.
  if ("displayName" in patch) {
    await db
      .update(schema.users)
      .set({
        displayName: merged.profile.displayName?.trim() || null,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, userId));
  }

  const profilePatch: Record<string, unknown> = {};
  for (const key of PROFILE_COLUMNS) {
    if (key in patch) profilePatch[key] = merged.profile[key];
  }
  if (Object.keys(profilePatch).length === 0) return;

  profilePatch.updatedAt = new Date();

  try {
    await db
      .insert(schema.userProfiles)
      .values({ userId, ...profilePatch })
      .onConflictDoUpdate({
        target: schema.userProfiles.userId,
        set: profilePatch,
      });
  } catch (err) {
    if (isUniqueViolation(err)) throw new UsernameTakenError();
    throw err;
  }
}

/**
 * Reset one group, or everything.
 *
 * Only touches the settings document. Conversations, files, projects, memory
 * and the account itself are deliberately untouched — resetting preferences is
 * not a data-deletion action, and a user who wanted that has separate,
 * confirmed buttons for it in Privacy & Data.
 */
export async function resetSettings(
  userId: string,
  group?: SettingsGroup
): Promise<UserSettings> {
  const current = await loadSettings(userId);
  const target = group ? resetGroup(current, group) : defaultSettings();

  // Written as an explicit patch so the same column-mapping code runs, rather
  // than a second path that could disagree with it.
  const patch: SettingsPatch = {};
  const groups = group ? [group] : (Object.keys(target) as SettingsGroup[]);
  for (const g of groups) {
    // Profile holds identity, not preference. "Reset all settings" must not
    // blank someone's name and country.
    if (g === "profile") continue;
    patch[g] = target[g] as never;
  }

  return saveSettings(userId, patch);
}
