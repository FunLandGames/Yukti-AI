// Drizzle schema for QWARA AI. Mirrors drizzle/0002_qwara_core_tables.sql.

import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  salt: text("salt").notNull(),
  role: text("role", { enum: ["user", "admin"] }).notNull().default("user"),
  emailVerified: integer("email_verified").notNull().default(0),
  verifyCode: text("verify_code"),
  firebaseUid: text("firebase_uid"),
  prefsJson: text("prefs_json").notNull().default("{}"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const sessions = sqliteTable("sessions", {
  token: text("token").primaryKey(),
  userId: integer("user_id").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const reviews = sqliteTable("reviews", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().unique(),
  stars: integer("stars").notNull(),
  text: text("text").notNull(),
  hidden: integer("hidden").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const feedback = sqliteTable("feedback", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id"),
  name: text("name").notNull(),
  message: text("message").notNull(),
  status: text("status", { enum: ["open", "resolved"] })
    .notNull()
    .default("open"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const announcements = sqliteTable("announcements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  active: integer("active").notNull().default(1),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const scores = sqliteTable("scores", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  game: text("game").notNull(),
  points: integer("points").notNull(),
  detail: text("detail").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const quizSessions = sqliteTable("quiz_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  level: text("level").notNull(),
  subject: text("subject").notNull(),
  difficulty: text("difficulty").notNull(),
  questionsJson: text("questions_json").notNull(),
  status: text("status", { enum: ["active", "submitted"] })
    .notNull()
    .default("active"),
  score: integer("score"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const notes = sqliteTable("notes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  clientId: text("client_id").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const reminders = sqliteTable("reminders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  clientId: text("client_id").notNull(),
  text: text("text").notNull(),
  dueText: text("due_text").notNull().default(""),
  done: integer("done").notNull().default(0),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const shortLinks = sqliteTable("short_links", {
  code: text("code").primaryKey(),
  url: text("url").notNull(),
  userId: integer("user_id"),
  clicks: integer("clicks").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const savedPrompts = sqliteTable("saved_prompts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  text: text("text").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

// One row per user per day they completed a quiz or a revision session
// (unique index on user_id+day in the migration). Streaks and badges are
// computed from these rows on the server — never from client claims.
export const studyDays = sqliteTable("study_days", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  day: text("day").notNull(), // the user's local calendar day, YYYY-MM-DD
  kind: text("kind").notNull().default("quiz"), // "quiz" | "revision"
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

// The user's scheduled morning briefing, generated once per user per day
// (unique index on user_id+day in the migration) by the prepare action, so
// it is ready when they open the app after their chosen time.
export const dailyBriefings = sqliteTable("daily_briefings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  day: text("day").notNull(), // the user's local calendar day, YYYY-MM-DD
  contentJson: text("content_json").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});
