// ============================================
// LUCID API — Personalization Service
// ============================================

import { eq } from "drizzle-orm";
import { db } from "../db";
import { personalizationProfiles } from "../db/schema";
import {
  PERSONALIZATION_COLD_START_THRESHOLD,
} from "@lucid/shared";
import type { PersonalizationProfile } from "@lucid/shared";

export async function loadProfile(
  userId: string
): Promise<PersonalizationProfile | null> {
  const rows = await db
    .select()
    .from(personalizationProfiles)
    .where(eq(personalizationProfiles.userId, userId))
    .limit(1);

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    id: row.id,
    userId: row.userId,
    tone: row.tone as PersonalizationProfile["tone"],
    length: row.length as PersonalizationProfile["length"],
    industry: row.industry,
    role: row.role,
    primaryModel: row.primaryModel as PersonalizationProfile["primaryModel"],
    customInstructions: row.customInstructions as string[],
    enhancementCount: row.enhancementCount,
    styleVectors: row.styleVectors as Record<string, number>,
    updatedAt: row.updatedAt,
  };
}

export function shouldApplyPersonalization(
  profile: PersonalizationProfile
): boolean {
  return profile.enhancementCount >= PERSONALIZATION_COLD_START_THRESHOLD;
}

export function applyPersonalization(
  profile: PersonalizationProfile,
  systemPrompt: string
): string {
  const personalizations: string[] = [];

  if (profile.tone) {
    personalizations.push(`The user prefers a ${profile.tone} tone.`);
  }

  if (profile.length) {
    personalizations.push(
      `The user prefers ${profile.length} length responses.`
    );
  }

  if (profile.industry) {
    personalizations.push(`The user works in the ${profile.industry} industry.`);
  }

  if (profile.role) {
    personalizations.push(`The user's role is ${profile.role}.`);
  }

  if (profile.customInstructions && profile.customInstructions.length > 0) {
    personalizations.push(
      `Additional user preferences: ${profile.customInstructions.join("; ")}`
    );
  }

  if (personalizations.length === 0) return systemPrompt;

  return `${systemPrompt}\n\n## User Personalization\n${personalizations.join("\n")}`;
}
