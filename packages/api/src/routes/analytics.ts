// ============================================
// LUCID API — Analytics Route
// GET /v1/analytics
// ============================================

import { Hono } from "hono";
import { eq, sql, gte, and, avg, count } from "drizzle-orm";
import { db } from "../db";
import { enhancements, feedback } from "../db/schema";
import { requireAuth } from "../middleware/auth";
import {
  PLAN_LIMITS,
  ENHANCEMENT_TIME_SAVED_MINUTES,
} from "@lucid/shared";
import type {
  Plan,
  AnalyticsResponse,
  TargetModel,
  EnhancementMode,
} from "@lucid/shared";
import type { AppEnv } from "../types";

const analytics = new Hono<AppEnv>();

// ── GET /v1/analytics ─────────────────────────

analytics.get("/", requireAuth, async (c) => {
  const user = c.get("user");
  const plan = user.plan as Plan;

  // Check plan allows analytics
  if (!PLAN_LIMITS[plan]?.analytics) {
    return c.json(
      { error: "Analytics requires a Pro plan or above" },
      403
    );
  }

  // --- Total enhancements ---
  const totalResult = await db
    .select({ total: count() })
    .from(enhancements)
    .where(eq(enhancements.userId, user.userId));

  const totalEnhancements = totalResult[0]?.total ?? 0;

  // --- Enhancements this month ---
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const monthResult = await db
    .select({ total: count() })
    .from(enhancements)
    .where(
      and(
        eq(enhancements.userId, user.userId),
        gte(enhancements.createdAt, startOfMonth)
      )
    );

  const enhancementsThisMonth = monthResult[0]?.total ?? 0;

  // --- Estimated time saved ---
  const estimatedTimeSavedMinutes =
    totalEnhancements * ENHANCEMENT_TIME_SAVED_MINUTES;

  // --- Average quality score from feedback ---
  const avgResult = await db
    .select({ avgRating: avg(feedback.rating) })
    .from(feedback)
    .where(eq(feedback.userId, user.userId));

  const averageQualityScore = avgResult[0]?.avgRating
    ? parseFloat(String(avgResult[0].avgRating))
    : 0;

  // --- Model distribution ---
  const modelRows = await db
    .select({
      model: enhancements.targetModel,
      total: count(),
    })
    .from(enhancements)
    .where(eq(enhancements.userId, user.userId))
    .groupBy(enhancements.targetModel);

  const modelDistribution: Record<TargetModel, number> = {
    chatgpt: 0,
    claude: 0,
    gemini: 0,
  };
  for (const row of modelRows) {
    const model = row.model as TargetModel;
    if (model in modelDistribution) {
      modelDistribution[model] = row.total;
    }
  }

  // --- Mode distribution ---
  const modeRows = await db
    .select({
      mode: enhancements.mode,
      total: count(),
    })
    .from(enhancements)
    .where(eq(enhancements.userId, user.userId))
    .groupBy(enhancements.mode);

  const modeDistribution: Record<EnhancementMode, number> = {
    enhance: 0,
    expand: 0,
    refine: 0,
    simplify: 0,
  };
  for (const row of modeRows) {
    const mode = row.mode as EnhancementMode;
    if (mode in modeDistribution) {
      modeDistribution[mode] = row.total;
    }
  }

  // --- Daily activity (last 30 days) ---
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const dailyRows = await db
    .select({
      date: sql<string>`DATE(${enhancements.createdAt})`.as("date"),
      total: count(),
    })
    .from(enhancements)
    .where(
      and(
        eq(enhancements.userId, user.userId),
        gte(enhancements.createdAt, thirtyDaysAgo)
      )
    )
    .groupBy(sql`DATE(${enhancements.createdAt})`)
    .orderBy(sql`DATE(${enhancements.createdAt})`);

  const dailyActivity = dailyRows.map((row) => ({
    date: row.date,
    count: row.total,
  }));

  const response: AnalyticsResponse = {
    totalEnhancements,
    enhancementsThisMonth,
    estimatedTimeSavedMinutes,
    averageQualityScore,
    modelDistribution,
    modeDistribution,
    dailyActivity,
  };

  return c.json(response);
});

export default analytics;
