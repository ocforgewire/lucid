// ============================================
// LUCID API — Drizzle Schema
// ============================================

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  real,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
  unique,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// ── Users ───────────────────────────────────

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    plan: varchar("plan", { length: 20 }).notNull().default("free"),
    stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("users_email_idx").on(table.email)]
);

export const usersRelations = relations(users, ({ one, many }) => ({
  personalizationProfile: one(personalizationProfiles, {
    fields: [users.id],
    references: [personalizationProfiles.userId],
  }),
  enhancements: many(enhancements),
  feedback: many(feedback),
  ownedTeams: many(teams),
  teamMemberships: many(teamMembers),
  subscriptions: many(subscriptions),
}));

// ── Personalization Profiles ────────────────

export const personalizationProfiles = pgTable(
  "personalization_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tone: varchar("tone", { length: 20 }).notNull().default("professional"),
    length: varchar("length", { length: 20 }).notNull().default("standard"),
    industry: varchar("industry", { length: 100 }).notNull().default(""),
    role: varchar("role", { length: 100 }).notNull().default(""),
    primaryModel: varchar("primary_model", { length: 20 })
      .notNull()
      .default("chatgpt"),
    customInstructions: jsonb("custom_instructions")
      .notNull()
      .$type<string[]>()
      .default([]),
    enhancementCount: integer("enhancement_count").notNull().default(0),
    styleVectors: jsonb("style_vectors")
      .notNull()
      .$type<Record<string, number>>()
      .default({}),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("personalization_profiles_user_id_idx").on(table.userId),
  ]
);

export const personalizationProfilesRelations = relations(
  personalizationProfiles,
  ({ one }) => ({
    user: one(users, {
      fields: [personalizationProfiles.userId],
      references: [users.id],
    }),
  })
);

// ── Enhancements (metadata only — never store prompt text) ──

export const enhancements = pgTable(
  "enhancements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mode: varchar("mode", { length: 20 }).notNull(),
    targetModel: varchar("target_model", { length: 20 }).notNull(),
    category: varchar("category", { length: 50 }).notNull().default("general"),
    qualityScore: real("quality_score"),
    durationMs: integer("duration_ms").notNull(),
    personalizationApplied: boolean("personalization_applied")
      .notNull()
      .default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("enhancements_user_id_created_at_idx").on(
      table.userId,
      table.createdAt
    ),
  ]
);

export const enhancementsRelations = relations(enhancements, ({ one, many }) => ({
  user: one(users, {
    fields: [enhancements.userId],
    references: [users.id],
  }),
  feedback: many(feedback),
}));

// ── Feedback ────────────────────────────────

export const feedback = pgTable(
  "feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    enhancementId: uuid("enhancement_id")
      .notNull()
      .references(() => enhancements.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    signal: varchar("signal", { length: 30 }).notNull(),
    rating: integer("rating"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("feedback_user_id_created_at_idx").on(
      table.userId,
      table.createdAt
    ),
    check("feedback_rating_check", sql`${table.rating} >= 1 AND ${table.rating} <= 5`),
  ]
);

export const feedbackRelations = relations(feedback, ({ one }) => ({
  enhancement: one(enhancements, {
    fields: [feedback.enhancementId],
    references: [enhancements.id],
  }),
  user: one(users, {
    fields: [feedback.userId],
    references: [users.id],
  }),
}));

// ── Teams ───────────────────────────────────

export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  plan: varchar("plan", { length: 20 }).notNull().default("team"),
  brandVoice: text("brand_voice"),
  maxSeats: integer("max_seats").notNull().default(5),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const teamsRelations = relations(teams, ({ one, many }) => ({
  owner: one(users, {
    fields: [teams.ownerId],
    references: [users.id],
  }),
  members: many(teamMembers),
}));

// ── Team Members ────────────────────────────

export const teamMembers = pgTable(
  "team_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 20 }).notNull().default("member"),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("team_members_team_id_user_id_unique").on(
      table.teamId,
      table.userId
    ),
  ]
);

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [teamMembers.userId],
    references: [users.id],
  }),
}));

// ── Subscriptions ───────────────────────────

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    stripeSubscriptionId: varchar("stripe_subscription_id", {
      length: 255,
    }).notNull(),
    plan: varchar("plan", { length: 20 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    currentPeriodStart: timestamp("current_period_start", {
      withTimezone: true,
    }).notNull(),
    currentPeriodEnd: timestamp("current_period_end", {
      withTimezone: true,
    }).notNull(),
  },
  (table) => [
    uniqueIndex("subscriptions_stripe_subscription_id_idx").on(
      table.stripeSubscriptionId
    ),
  ]
);

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
}));
