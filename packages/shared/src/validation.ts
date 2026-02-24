// ============================================
// LUCID — Shared Validation
// ============================================

import type { EnhancementMode, TargetModel, TonePreference, LengthPreference, FeedbackSignal } from "./types";

const VALID_MODES: EnhancementMode[] = ["enhance", "expand", "refine", "simplify"];
const VALID_MODELS: TargetModel[] = ["chatgpt", "claude", "gemini"];
const VALID_TONES: TonePreference[] = ["professional", "casual", "technical", "creative"];
const VALID_LENGTHS: LengthPreference[] = ["concise", "standard", "detailed"];
const VALID_SIGNALS: FeedbackSignal[] = ["sent_unedited", "sent_edited", "undone", "thumbs_up", "thumbs_down"];

export function isValidMode(mode: string): mode is EnhancementMode {
  return VALID_MODES.includes(mode as EnhancementMode);
}

export function isValidModel(model: string): model is TargetModel {
  return VALID_MODELS.includes(model as TargetModel);
}

export function isValidTone(tone: string): tone is TonePreference {
  return VALID_TONES.includes(tone as TonePreference);
}

export function isValidLength(length: string): length is LengthPreference {
  return VALID_LENGTHS.includes(length as LengthPreference);
}

export function isValidSignal(signal: string): signal is FeedbackSignal {
  return VALID_SIGNALS.includes(signal as FeedbackSignal);
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidPassword(password: string): boolean {
  return password.length >= 8;
}

export function isValidIntent(intent: string): boolean {
  return intent.trim().length >= 3 && intent.length <= 10000;
}

export function isValidRating(rating: number): boolean {
  return Number.isInteger(rating) && rating >= 1 && rating <= 5;
}
