// Hetex AI — Database Schema (Phase 1), Drizzle ORM / SQLite for local dev.
// Swap `drizzle-orm/better-sqlite3` + this schema's column types for
// `drizzle-orm/node-postgres` in production; the shape stays the same.

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => createId());

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
};

export const users = sqliteTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  ...timestamps,
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const userSettings = sqliteTable("user_settings", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  theme: text("theme").notNull().default("system"),
  assistantName: text("assistant_name").notNull().default("Hetex AI"),
  responseStyle: text("response_style").notNull().default("balanced"),
  memoryEnabled: integer("memory_enabled", { mode: "boolean" })
    .notNull()
    .default(false),
  enterToSend: integer("enter_to_send", { mode: "boolean" })
    .notNull()
    .default(true),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const projects = sqliteTable("projects", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  instructions: text("instructions"),
  ...timestamps,
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const conversations = sqliteTable("conversations", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  projectId: text("project_id").references(() => projects.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull().default("New Chat"),
  model: text("model").notNull().default("claude-sonnet-4-6"),
  ...timestamps,
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const messages = sqliteTable("messages", {
  id: id(),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // user | assistant | system
  content: text("content").notNull(),
  ...timestamps,
});

export const libraryAssets = sqliteTable("library_assets", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // image | video | document | code | other
  url: text("url").notNull(),
  prompt: text("prompt"),
  conversationId: text("conversation_id"),
  ...timestamps,
});

export const usageRecords = sqliteTable("usage_records", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // message | token | image | video | voice | tool_call
  amount: integer("amount").notNull().default(1),
  ...timestamps,
});

export const messageFeedback = sqliteTable("message_feedback", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  messageId: text("message_id").notNull(),
  conversationId: text("conversation_id"),
  rating: text("rating").notNull(), // up | down
  ...timestamps,
});

export const userMemory = sqliteTable("user_memory", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  source: text("source").notNull().default("manual"), // manual | inferred
  ...timestamps,
});

// Relations (used for query-builder joins like db.query.conversations.findMany({ with: { messages: true } }))
export const usersRelations = relations(users, ({ many, one }) => ({
  conversations: many(conversations),
  projects: many(projects),
  libraryAssets: many(libraryAssets),
  usageRecords: many(usageRecords),
  settings: one(userSettings, {
    fields: [users.id],
    references: [userSettings.userId],
  }),
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
