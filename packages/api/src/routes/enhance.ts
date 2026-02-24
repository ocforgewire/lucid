// ============================================
// LUCID API — Enhancement Route (THE CORE ENDPOINT)
// POST /v1/enhance
// ============================================

import { Hono } from "hono";
import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import { enhancements, personalizationProfiles } from "../db/schema";
import { requireAuth } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";
import { translate } from "../pipeline/translate";
import { optimize } from "../pipeline/optimize";
import { assemble } from "../pipeline/assemble";
import {
  loadProfile,
  shouldApplyPersonalization,
} from "../services/personalization";
import {
  isValidMode,
  isValidModel,
  isValidIntent,
  PLAN_LIMITS,
} from "@lucid/shared";
import type {
  Plan,
  EnhancementMode,
  TargetModel,
  PromptCategory,
} from "@lucid/shared";
import type { AppEnv } from "../types";

const enhance = new Hono<AppEnv>();

// ── Category Detection ────────────────────────
// Simple keyword-based category detection from intent text.

const CATEGORY_KEYWORDS: Record<PromptCategory, string[]> = {
  email: [
    "email",
    "mail",
    "newsletter",
    "outreach",
    "reply",
    "follow up",
    "follow-up",
    "subject line",
  ],
  code: [
    "code",
    "function",
    "api",
    "debug",
    "refactor",
    "implement",
    "algorithm",
    "programming",
    "typescript",
    "javascript",
    "python",
    "sql",
    "query",
    "bug",
    "test",
  ],
  analysis: [
    "analyze",
    "analysis",
    "report",
    "data",
    "compare",
    "evaluate",
    "research",
    "study",
    "review",
    "assess",
  ],
  creative: [
    "story",
    "poem",
    "creative",
    "fiction",
    "write",
    "blog",
    "article",
    "content",
    "narrative",
    "script",
  ],
  marketing: [
    "marketing",
    "ad",
    "campaign",
    "brand",
    "copy",
    "headline",
    "tagline",
    "social media",
    "seo",
    "landing page",
  ],
  legal: [
    "legal",
    "contract",
    "terms",
    "policy",
    "compliance",
    "regulation",
    "agreement",
    "clause",
  ],
  general: [],
};

function detectCategory(intent: string): PromptCategory {
  const lower = intent.toLowerCase();

  let bestCategory: PromptCategory = "general";
  let bestScore = 0;

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (category === "general") continue;

    let score = 0;
    for (const keyword of keywords) {
      if (lower.includes(keyword)) score++;
    }

    if (score > bestScore) {
      bestScore = score;
      bestCategory = category as PromptCategory;
    }
  }

  return bestCategory;
}

// ── POST /v1/enhance ──────────────────────────

enhance.post("/", requireAuth, rateLimit, async (c) => {
  const user = c.get("user");
  const body = await c.req.json<{
    intent?: string;
    mode?: string;
    targetModel?: string;
  }>();

  // --- Validate request ---

  const { intent, mode, targetModel } = body;

  if (!intent || !isValidIntent(intent)) {
    return c.json(
      { error: "Intent is required (3-10000 characters)" },
      400
    );
  }

  if (!mode || !isValidMode(mode)) {
    return c.json(
      {
        error:
          "Invalid mode. Must be: enhance, expand, refine, or simplify",
      },
      400
    );
  }

  if (!targetModel || !isValidModel(targetModel)) {
    return c.json(
      {
        error:
          "Invalid target model. Must be: chatgpt, claude, or gemini",
      },
      400
    );
  }

  // --- Check plan allows target model ---

  const plan = user.plan as Plan;
  const planLimits = PLAN_LIMITS[plan];

  if (!planLimits) {
    return c.json({ error: "Invalid user plan" }, 403);
  }

  const allowedModels = planLimits.models as readonly string[];
  if (!allowedModels.includes(targetModel)) {
    return c.json(
      {
        error: `Your ${plan} plan does not include access to ${targetModel}. Upgrade to access all models.`,
      },
      403
    );
  }

  // --- Start timer ---
  const startTime = performance.now();

  try {
    // --- Load personalization ---
    let personalization = null;
    let personalizationApplied = false;

    if (planLimits.personalization) {
      const profile = await loadProfile(user.userId);
      if (profile && shouldApplyPersonalization(profile)) {
        personalization = profile;
        personalizationApplied = true;
      }
    }

    // --- Layer 1: Translate intent to structured prompt (Haiku) ---
    const structured = await translate(
      intent,
      mode as EnhancementMode,
      personalization
    );

    // --- Layer 2: Optimize for target model (rule engine) ---
    const optimized = optimize(structured, targetModel as TargetModel);

    // --- Layer 3: Assemble final prompt ---
    const assembled = assemble(optimized);

    // --- Stop timer ---
    const durationMs = Math.round(performance.now() - startTime);

    // --- Detect category ---
    const category = detectCategory(intent);

    // --- Store enhancement metadata (NOT the actual prompt text) ---
    const enhancementId = crypto.randomUUID();

    await db.insert(enhancements).values({
      id: enhancementId,
      userId: user.userId,
      mode,
      targetModel,
      category,
      durationMs,
      personalizationApplied,
    });

    // --- Increment personalization enhancementCount ---
    await db
      .update(personalizationProfiles)
      .set({
        enhancementCount: sql`${personalizationProfiles.enhancementCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(personalizationProfiles.userId, user.userId));

    // --- Return response ---
    return c.json({
      enhanced: assembled.assembled,
      structured: assembled,
      mode,
      targetModel,
      personalizationApplied,
      durationMs,
      enhancementId,
    });
  } catch (error) {
    const durationMs = Math.round(performance.now() - startTime);
    console.error("Enhancement failed:", error);

    if (
      error instanceof Error &&
      error.message.includes("ANTHROPIC_API_KEY")
    ) {
      return c.json({ error: "AI service not configured" }, 503);
    }

    return c.json(
      {
        error: "Enhancement failed. Please try again.",
        durationMs,
      },
      500
    );
  }
});

export default enhance;
