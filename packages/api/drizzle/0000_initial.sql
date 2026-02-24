-- ============================================
-- LUCID — Initial Schema Migration
-- ============================================

-- Users
CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" varchar(255) NOT NULL,
  "password_hash" varchar(255) NOT NULL,
  "name" varchar(255) NOT NULL,
  "plan" varchar(20) NOT NULL DEFAULT 'free',
  "stripe_customer_id" varchar(255),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "users_email_idx" ON "users" ("email");

-- Personalization Profiles
CREATE TABLE IF NOT EXISTS "personalization_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "tone" varchar(20) NOT NULL DEFAULT 'professional',
  "length" varchar(20) NOT NULL DEFAULT 'standard',
  "industry" varchar(100) NOT NULL DEFAULT '',
  "role" varchar(100) NOT NULL DEFAULT '',
  "primary_model" varchar(20) NOT NULL DEFAULT 'chatgpt',
  "custom_instructions" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "enhancement_count" integer NOT NULL DEFAULT 0,
  "style_vectors" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "personalization_profiles_user_id_idx" ON "personalization_profiles" ("user_id");

-- Enhancements
CREATE TABLE IF NOT EXISTS "enhancements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "mode" varchar(20) NOT NULL,
  "target_model" varchar(20) NOT NULL,
  "category" varchar(50) NOT NULL DEFAULT 'general',
  "quality_score" real,
  "duration_ms" integer NOT NULL,
  "personalization_applied" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "enhancements_user_id_created_at_idx" ON "enhancements" ("user_id", "created_at");

-- Feedback
CREATE TABLE IF NOT EXISTS "feedback" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "enhancement_id" uuid NOT NULL REFERENCES "enhancements"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "signal" varchar(30) NOT NULL,
  "rating" integer,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "feedback_rating_check" CHECK ("rating" >= 1 AND "rating" <= 5)
);

CREATE INDEX IF NOT EXISTS "feedback_user_id_created_at_idx" ON "feedback" ("user_id", "created_at");

-- Teams
CREATE TABLE IF NOT EXISTS "teams" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" varchar(255) NOT NULL,
  "owner_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "plan" varchar(20) NOT NULL DEFAULT 'team',
  "brand_voice" text,
  "max_seats" integer NOT NULL DEFAULT 5,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Team Members
CREATE TABLE IF NOT EXISTS "team_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "team_id" uuid NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role" varchar(20) NOT NULL DEFAULT 'member',
  "joined_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "team_members_team_id_user_id_unique" UNIQUE ("team_id", "user_id")
);

-- Subscriptions
CREATE TABLE IF NOT EXISTS "subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "stripe_subscription_id" varchar(255) NOT NULL,
  "plan" varchar(20) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'active',
  "current_period_start" timestamp with time zone NOT NULL,
  "current_period_end" timestamp with time zone NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_stripe_subscription_id_idx" ON "subscriptions" ("stripe_subscription_id");
