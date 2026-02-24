// ============================================
// LUCID API — Feedback Route
// POST /v1/feedback
// ============================================

import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { feedback, enhancements } from "../db/schema";
import { requireAuth } from "../middleware/auth";
import { isValidSignal, isValidRating } from "@lucid/shared";
import type { FeedbackSignal } from "@lucid/shared";
import type { AppEnv } from "../types";

const feedbackRoute = new Hono<AppEnv>();

// ── POST /v1/feedback ─────────────────────────

feedbackRoute.post("/", requireAuth, async (c) => {
  const user = c.get("user");
  const body = await c.req.json<{
    enhancementId?: string;
    signal?: string;
    rating?: number;
  }>();

  const { enhancementId, signal, rating } = body;

  // --- Validate enhancementId ---
  if (!enhancementId || typeof enhancementId !== "string") {
    return c.json({ error: "enhancementId is required" }, 400);
  }

  // Verify the enhancement exists and belongs to this user
  const enhancementRows = await db
    .select({ id: enhancements.id, userId: enhancements.userId })
    .from(enhancements)
    .where(eq(enhancements.id, enhancementId))
    .limit(1);

  if (enhancementRows.length === 0) {
    return c.json({ error: "Enhancement not found" }, 404);
  }

  if (enhancementRows[0].userId !== user.userId) {
    return c.json({ error: "Enhancement not found" }, 404);
  }

  // --- Validate signal ---
  if (!signal || !isValidSignal(signal)) {
    return c.json(
      {
        error:
          "Invalid signal. Must be: sent_unedited, sent_edited, undone, thumbs_up, or thumbs_down",
      },
      400
    );
  }

  // --- Validate optional rating ---
  if (rating !== undefined && rating !== null) {
    if (!isValidRating(rating)) {
      return c.json(
        { error: "Rating must be an integer between 1 and 5" },
        400
      );
    }
  }

  // --- Insert feedback ---
  const feedbackId = crypto.randomUUID();

  await db.insert(feedback).values({
    id: feedbackId,
    enhancementId,
    userId: user.userId,
    signal: signal as FeedbackSignal,
    rating: rating ?? null,
  });

  // --- Update enhancement quality score if rating provided ---
  if (rating !== undefined && rating !== null) {
    await db
      .update(enhancements)
      .set({ qualityScore: rating })
      .where(eq(enhancements.id, enhancementId));
  }

  return c.json({
    id: feedbackId,
    enhancementId,
    signal,
    rating: rating ?? null,
    createdAt: new Date().toISOString(),
  });
});

export default feedbackRoute;
