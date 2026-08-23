// Hetex AI — Database Schema (PostgreSQL / Drizzle ORM).
//
// Ported from the original SQLite schema. The table shapes, column names, and
// relations are identical; only the column type helpers differ:
//   sqliteTable                            -> pgTable
//   integer(..., { mode: "timestamp" })    -> timestamp(..., { withTimezone: true })
//   integer(..., { mode: "boolean" })      -> boolean(...)

import { pgTable, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
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
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const userSettings = pgTable("user_settings", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  theme: text("theme").notNull().default("system"),
  assistantName: text("assistant_name").notNull().default("Hetex AI"),
  responseStyle: text("response_style").notNull().default("balanced"),
  memoryEnabled: boolean("memory_enabled").notNull().default(false),
  enterToSend: boolean("enter_to_send").notNull().default(true),
  updatedAt: updatedAt(),
});

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

export const conversations = pgTable("conversations", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  projectId: text("project_id").references(() => projects.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull().default("New Chat"),
  model: text("model").notNull().default("claude-sonnet-4-6"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

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

export const userMemory = pgTable("user_memory", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  source: text("source").notNull().default("manual"), // manual | inferred
  createdAt: createdAt(),
});

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
