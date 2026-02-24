// ============================================
// LUCID API — Profile Route (Personalization)
// GET /v1/profile, PUT /v1/profile
// ============================================

import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { personalizationProfiles } from "../db/schema";
import { requireAuth } from "../middleware/auth";
import {
  isValidTone,
  isValidLength,
  isValidModel,
} from "@lucid/shared";
import type { TonePreference, LengthPreference, TargetModel } from "@lucid/shared";
import type { AppEnv } from "../types";

const profile = new Hono<AppEnv>();

// ── GET /v1/profile ───────────────────────────

profile.get("/", requireAuth, async (c) => {
  const user = c.get("user");

  const rows = await db
    .select()
    .from(personalizationProfiles)
    .where(eq(personalizationProfiles.userId, user.userId))
    .limit(1);

  if (rows.length === 0) {
    return c.json({ error: "Personalization profile not found" }, 404);
  }

  const p = rows[0];

  return c.json({
    id: p.id,
    userId: p.userId,
    tone: p.tone,
    length: p.length,
    industry: p.industry,
    role: p.role,
    primaryModel: p.primaryModel,
    customInstructions: p.customInstructions,
    enhancementCount: p.enhancementCount,
    styleVectors: p.styleVectors,
    updatedAt: p.updatedAt,
  });
});

// ── PUT /v1/profile ───────────────────────────

profile.put("/", requireAuth, async (c) => {
  const user = c.get("user");
  const body = await c.req.json<{
    tone?: string;
    length?: string;
    industry?: string;
    role?: string;
    primaryModel?: string;
    customInstructions?: string[];
  }>();

  // Build update object with validated fields
  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (body.tone !== undefined) {
    if (!isValidTone(body.tone)) {
      return c.json(
        {
          error:
            "Invalid tone. Must be: professional, casual, technical, or creative",
        },
        400
      );
    }
    updates.tone = body.tone as TonePreference;
  }

  if (body.length !== undefined) {
    if (!isValidLength(body.length)) {
      return c.json(
        {
          error:
            "Invalid length. Must be: concise, standard, or detailed",
        },
        400
      );
    }
    updates.length = body.length as LengthPreference;
  }

  if (body.industry !== undefined) {
    if (typeof body.industry !== "string" || body.industry.length > 100) {
      return c.json(
        { error: "Industry must be a string under 100 characters" },
        400
      );
    }
    updates.industry = body.industry;
  }

  if (body.role !== undefined) {
    if (typeof body.role !== "string" || body.role.length > 100) {
      return c.json(
        { error: "Role must be a string under 100 characters" },
        400
      );
    }
    updates.role = body.role;
  }

  if (body.primaryModel !== undefined) {
    if (!isValidModel(body.primaryModel)) {
      return c.json(
        {
          error:
            "Invalid primary model. Must be: chatgpt, claude, or gemini",
        },
        400
      );
    }
    updates.primaryModel = body.primaryModel as TargetModel;
  }

  if (body.customInstructions !== undefined) {
    if (!Array.isArray(body.customInstructions)) {
      return c.json(
        { error: "customInstructions must be an array of strings" },
        400
      );
    }
    if (body.customInstructions.length > 10) {
      return c.json(
        { error: "Maximum 10 custom instructions allowed" },
        400
      );
    }
    for (const instruction of body.customInstructions) {
      if (typeof instruction !== "string" || instruction.length > 500) {
        return c.json(
          {
            error:
              "Each custom instruction must be a string under 500 characters",
          },
          400
        );
      }
    }
    updates.customInstructions = body.customInstructions;
  }

  // Perform update
  const result = await db
    .update(personalizationProfiles)
    .set(updates)
    .where(eq(personalizationProfiles.userId, user.userId))
    .returning();

  if (result.length === 0) {
    return c.json({ error: "Personalization profile not found" }, 404);
  }

  const p = result[0];

  return c.json({
    id: p.id,
    userId: p.userId,
    tone: p.tone,
    length: p.length,
    industry: p.industry,
    role: p.role,
    primaryModel: p.primaryModel,
    customInstructions: p.customInstructions,
    enhancementCount: p.enhancementCount,
    styleVectors: p.styleVectors,
    updatedAt: p.updatedAt,
  });
});

export default profile;
