// Aviel AI — Database Schema (PostgreSQL / Drizzle ORM).
//
// Ported from the original SQLite schema. The table shapes, column names, and
// relations are identical; only the column type helpers differ:
//   sqliteTable                            -> pgTable
//   integer(..., { mode: "timestamp" })    -> timestamp(..., { withTimezone: true })
//   integer(..., { mode: "boolean" })      -> boolean(...)

import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => createId());

const createdAt = () =>
  timestamp("created_at", { withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date());

const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date());

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  role: text("role").notNull().default("user"),

  // Two-factor. The secret is a base32 TOTP seed; `totpEnabled` is what the
  // login path checks, so a half-finished enrolment (secret written, never
  // confirmed) cannot lock anybody out.
  totpSecret: text("totp_secret"),
  totpEnabled: boolean("totp_enabled").notNull().default(false),
  totpConfirmedAt: timestamp("totp_confirmed_at", { withTimezone: true }),
  // bcrypt hashes, not the codes themselves — a database dump must not be a
  // list of working bypasses. Each is removed as it is used.
  totpRecoveryCodes: jsonb("totp_recovery_codes")
    .$type<string[]>()
    .notNull()
    .default([]),

  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/**
 * Profile fields, separate from `users` and from the settings blob.
 *
 * These are looked up on their own — a username has to be unique across the
 * platform, and that is an index, not a scan of every account's jsonb.
 */
export const userProfiles = pgTable(
  "user_profiles",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    fullName: text("full_name"),
    username: text("username"),
    phone: text("phone"),
    country: text("country"),
    timezone: text("timezone"),
    preferredName: text("preferred_name"),
    preferredGreeting: text("preferred_greeting"),
    pronunciation: text("pronunciation"),
    birthday: text("birthday"),
    occupation: text("occupation"),
    interests: jsonb("interests").$type<string[]>().notNull().default([]),
    updatedAt: updatedAt(),
  },
  (t) => ({
    // Partial-unique is not expressible here, so uniqueness is enforced on the
    // column and the route refuses a duplicate with a readable message. Nulls
    // do not collide in Postgres, so accounts with no username are unaffected.
    usernameIdx: uniqueIndex("user_profiles_username_idx").on(t.username),
  })
);

/**
 * Platform-wide configuration owned by administrators.
 *
 * One row. Kept in a table rather than the environment because a feature flag
 * has to be changeable without a redeploy, and because the admin dashboard
 * needs somewhere to write.
 */
export const platformConfig = pgTable("platform_config", {
  id: text("id").primaryKey(),
  config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
  updatedAt: updatedAt(),
});

/** Bug reports, safety reports and feedback raised from Help & Support. */
export const supportReports = pgTable(
  "support_reports",
  {
    id: id(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    kind: text("kind").notNull(), // bug | ai_response | safety | feedback | contact
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    // Diagnostics the reporter chose to attach, plus the message being reported.
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    status: text("status").notNull().default("open"),
    createdAt: createdAt(),
  },
  (t) => ({
    kindIdx: index("support_reports_kind_idx").on(t.kind, t.status),
    userIdx: index("support_reports_user_idx").on(t.userId),
  })
);

export const userSettings = pgTable("user_settings", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  theme: text("theme").notNull().default("light"),
  accentColor: text("accent_color").notNull().default("green"),
  textSize: text("text_size").notNull().default("medium"),
  assistantName: text("assistant_name").notNull().default("Aviel AI"),
  responseStyle: text("response_style").notNull().default("balanced"),
  // "Higher intelligence" — a more capable, more expensive model per request.
  model: text("model").notNull().default("standard"),
  memoryEnabled: boolean("memory_enabled").notNull().default(false),
  enterToSend: boolean("enter_to_send").notNull().default(true),
  dictationEnabled: boolean("dictation_enabled").notNull().default(true),
  // Browser speech-synthesis voice name for Read Aloud. Null means the
  // browser's default, which is all most people ever need.
  voiceName: text("voice_name"),
  // Speech-recognition language for dictation. Separate from `language`, which
  // is interface copy — people often dictate in a different language to the one
  // they read menus in.
  voiceInputLang: text("voice_input_lang"),

  // Interface language. "auto" follows the browser. Stored now; no translations
  // exist yet, so nothing reads this beyond the settings screen itself.
  language: text("language").notNull().default("auto"),

  // Desktop-only. Meaningless in a browser, stored so a future desktop build
  // inherits the preference rather than asking again.
  launchAtLogin: boolean("launch_at_login").notNull().default(false),

  // Per-category delivery channel: "push" | "email" | "push_email" | "off".
  // jsonb rather than a column per category so adding a category is a code
  // change, not a migration.
  notificationPrefs: jsonb("notification_prefs")
    .$type<Record<string, string>>()
    .notNull()
    .default({}),

  // Prepended to the system prompt on every conversation.
  customInstructions: text("custom_instructions"),

  // When false, conversations are not persisted past the live turn.
  chatHistoryEnabled: boolean("chat_history_enabled").notNull().default(true),
  // Opt-in, and honoured by being false: nothing here is used for training.
  trainingOptIn: boolean("training_opt_in").notNull().default(false),

  exportRequestedAt: timestamp("export_requested_at", { withTimezone: true }),
  deleteRequestedAt: timestamp("delete_requested_at", { withTimezone: true }),

  // ---- Grouped preferences ------------------------------------------------
  //
  // The scalar columns above are the ones something other than the settings
  // screen reads: the chat service reads model/memory/history, the admin
  // dashboard aggregates over them, and an index or a GROUP BY on jsonb would
  // be the wrong shape for that.
  //
  // Everything below is only ever read as a whole document for one account, so
  // a column per key would be ~140 columns and a migration per new toggle for
  // no gain. One jsonb per group is the honest middle: normalised where it is
  // queried, grouped where it is not.
  //
  // Each defaults to {} rather than to the group's defaults, so the meaning of
  // "unset" stays "whatever the schema says today" — changing a default in
  // code does not need a data migration.
  aiPrefs: jsonb("ai_prefs").$type<Record<string, unknown>>().notNull().default({}),
  personality: jsonb("personality").$type<Record<string, unknown>>().notNull().default({}),
  behavior: jsonb("behavior").$type<Record<string, unknown>>().notNull().default({}),
  memoryPrefs: jsonb("memory_prefs").$type<Record<string, unknown>>().notNull().default({}),
  conversationPrefs: jsonb("conversation_prefs").$type<Record<string, unknown>>().notNull().default({}),
  voicePrefs: jsonb("voice_prefs").$type<Record<string, unknown>>().notNull().default({}),
  liveVoicePrefs: jsonb("live_voice_prefs").$type<Record<string, unknown>>().notNull().default({}),
  imagePrefs: jsonb("image_prefs").$type<Record<string, unknown>>().notNull().default({}),
  filePrefs: jsonb("file_prefs").$type<Record<string, unknown>>().notNull().default({}),
  appearance: jsonb("appearance").$type<Record<string, unknown>>().notNull().default({}),
  languagePrefs: jsonb("language_prefs").$type<Record<string, unknown>>().notNull().default({}),
  accessibility: jsonb("accessibility").$type<Record<string, unknown>>().notNull().default({}),
  notificationSettings: jsonb("notification_settings").$type<Record<string, unknown>>().notNull().default({}),
  privacyPrefs: jsonb("privacy_prefs").$type<Record<string, unknown>>().notNull().default({}),
  securityPrefs: jsonb("security_prefs").$type<Record<string, unknown>>().notNull().default({}),
  safetyPrefs: jsonb("safety_prefs").$type<Record<string, unknown>>().notNull().default({}),
  projectPrefs: jsonb("project_prefs").$type<Record<string, unknown>>().notNull().default({}),
  libraryPrefs: jsonb("library_prefs").$type<Record<string, unknown>>().notNull().default({}),
  offlinePrefs: jsonb("offline_prefs").$type<Record<string, unknown>>().notNull().default({}),
  advancedPrefs: jsonb("advanced_prefs").$type<Record<string, unknown>>().notNull().default({}),

  updatedAt: updatedAt(),
});

/**
 * Issued bearer tokens, so "log out of this device" can mean something.
 *
 * A JWT is self-contained and normally valid until it expires — there is no
 * server-side handle to pull. Recording each issued token and checking it on
 * every authenticated request is what makes revocation real, at the cost of
 * one indexed lookup per request.
 */
export const userSessions = pgTable(
  "user_sessions",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date()),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => ({
    // Every authenticated request filters on these two.
    userIdx: index("user_sessions_user_idx").on(t.userId),
    activeIdx: index("user_sessions_active_idx").on(t.userId, t.revokedAt),
  })
);

/**
 * Third-party tools an account has connected.
 *
 * Nothing is connected today — no provider is implemented. The table exists so
 * the Plugins screen reflects real state (everything disconnected) rather than
 * showing toggles that do nothing, and so connecting one later is a provider
 * implementation rather than a schema change.
 */
export const userIntegrations = pgTable(
  "user_integrations",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    status: text("status").notNull().default("disconnected"),
    config: jsonb("config").$type<Record<string, unknown>>(),
    connectedAt: timestamp("connected_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => ({
    userProvider: uniqueIndex("user_integrations_user_provider_idx").on(
      t.userId,
      t.provider
    ),
  })
);

export const projects = pgTable("projects", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  instructions: text("instructions"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const conversations = pgTable(
  "conversations",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: text("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull().default("New Chat"),
    model: text("model").notNull().default("standard"),
    pinned: boolean("pinned").notNull().default(false),
    // "Do not remember this conversation" — checked before anything is written
    // to memory, so the exclusion holds for every future turn too, not just the
    // one where it was switched on.
    excludeFromMemory: boolean("exclude_from_memory").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    // The retention sweeper scans by age within an account; without this it is
    // a full table scan every time it runs.
    userUpdatedIdx: index("conversations_user_updated_idx").on(
      t.userId,
      t.updatedAt
    ),
  })
);

export const messages = pgTable("messages", {
  id: id(),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // user | assistant | system
  content: text("content").notNull(),
  createdAt: createdAt(),
});

export const libraryAssets = pgTable("library_assets", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // image | video | document | code | other
  url: text("url").notNull(),
  name: text("name"),
  mediaType: text("media_type"),
  prompt: text("prompt"),
  conversationId: text("conversation_id"),
  createdAt: createdAt(),
});

export const usageRecords = pgTable("usage_records", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // message | token | image | video | voice | tool_call
  amount: integer("amount").notNull().default(1),
  createdAt: createdAt(),
});

export const messageFeedback = pgTable("message_feedback", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  messageId: text("message_id").notNull(),
  conversationId: text("conversation_id"),
  rating: text("rating").notNull(), // up | down
  createdAt: createdAt(),
});

export const userMemory = pgTable(
  "user_memory",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    source: text("source").notNull().default("manual"), // manual | inferred
    // preferences | projects | personalization | conversation. Which categories
    // are written at all is a per-account setting, so this has to be stored
    // rather than inferred at read time.
    category: text("category").notNull().default("preferences"),
    updatedAt: updatedAt(),
    createdAt: createdAt(),
  },
  (t) => ({
    userIdx: index("user_memory_user_idx").on(t.userId, t.category),
  })
);

export const libraryAssetsRelations = relations(libraryAssets, ({ one }) => ({
  user: one(users, { fields: [libraryAssets.userId], references: [users.id] }),
}));

// Relations (used for query-builder joins like
// db.query.conversations.findMany({ with: { messages: true } }))
export const usersRelations = relations(users, ({ many, one }) => ({
  conversations: many(conversations),
  projects: many(projects),
  libraryAssets: many(libraryAssets),
  usageRecords: many(usageRecords),
  settings: one(userSettings, {
    fields: [users.id],
    references: [userSettings.userId],
  }),
  profile: one(userProfiles, {
    fields: [users.id],
    references: [userProfiles.userId],
  }),
}));

export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
  user: one(users, { fields: [userProfiles.userId], references: [users.id] }),
}));

export const conversationsRelations = relations(
  conversations,
  ({ many, one }) => ({
    messages: many(messages),
    user: one(users, {
      fields: [conversations.userId],
      references: [users.id],
    }),
    project: one(projects, {
      fields: [conversations.projectId],
      references: [projects.id],
    }),
  })
);

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));

export const projectsRelations = relations(projects, ({ many, one }) => ({
  conversations: many(conversations),
  user: one(users, { fields: [projects.userId], references: [users.id] }),
}));
