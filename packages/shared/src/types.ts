// ============================================
// LUCID — Shared Type Definitions
// ============================================

// --- Enums ---

export type Plan = "free" | "pro" | "team" | "business" | "api";

export type EnhancementMode = "enhance" | "expand" | "refine" | "simplify";

export type TargetModel = "chatgpt" | "claude" | "gemini";

export type TonePreference =
  | "professional"
  | "casual"
  | "technical"
  | "creative";

export type LengthPreference = "concise" | "standard" | "detailed";

export type PromptCategory =
  | "email"
  | "code"
  | "analysis"
  | "creative"
  | "marketing"
  | "legal"
  | "general";

export type FeedbackSignal =
  | "sent_unedited"
  | "sent_edited"
  | "undone"
  | "thumbs_up"
  | "thumbs_down";

// --- User ---

export interface User {
  id: string;
  email: string;
  name: string;
  plan: Plan;
  stripeCustomerId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// --- Personalization ---

export interface PersonalizationProfile {
  id: string;
  userId: string;
  tone: TonePreference;
  length: LengthPreference;
  industry: string;
  role: string;
  primaryModel: TargetModel;
  customInstructions: string[];
  enhancementCount: number;
  styleVectors: Record<string, number>;
  updatedAt: Date;
}

// --- Enhancement ---

export interface Enhancement {
  id: string;
  userId: string;
  mode: EnhancementMode;
  targetModel: TargetModel;
  category: PromptCategory;
  qualityScore: number | null;
  durationMs: number;
  personalizationApplied: boolean;
  createdAt: Date;
}

// --- Feedback ---

export interface Feedback {
  id: string;
  enhancementId: string;
  userId: string;
  signal: FeedbackSignal;
  rating: number | null; // 1-5
  createdAt: Date;
}

// --- Team ---

export interface Team {
  id: string;
  name: string;
  ownerId: string;
  plan: Plan;
  brandVoice: string | null;
  maxSeats: number;
  createdAt: Date;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: "owner" | "admin" | "member";
  joinedAt: Date;
}

// --- Subscription ---

export interface Subscription {
  id: string;
  userId: string;
  stripeSubscriptionId: string;
  plan: Plan;
  status: "active" | "past_due" | "canceled" | "trialing";
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
}

// --- API Request/Response ---

export interface EnhanceRequest {
  intent: string;
  mode: EnhancementMode;
  targetModel: TargetModel;
}

export interface EnhanceResponse {
  enhanced: string;
  structured: StructuredPrompt;
  mode: EnhancementMode;
  targetModel: TargetModel;
  personalizationApplied: boolean;
  durationMs: number;
  enhancementId: string;
}

export interface StructuredPrompt {
  role: string | null;
  context: string | null;
  task: string;
  format: string | null;
  constraints: string | null;
  tone: string | null;
  assembled: string; // The final prompt string
}

export interface FeedbackRequest {
  enhancementId: string;
  signal: FeedbackSignal;
  rating?: number;
}

export interface AnalyticsResponse {
  totalEnhancements: number;
  enhancementsThisMonth: number;
  estimatedTimeSavedMinutes: number;
  averageQualityScore: number;
  modelDistribution: Record<TargetModel, number>;
  modeDistribution: Record<EnhancementMode, number>;
  dailyActivity: { date: string; count: number }[];
}

// --- Auth ---

export interface AuthTokenPayload {
  userId: string;
  email: string;
  plan: Plan;
}

export interface SignupRequest {
  email: string;
  password: string;
  name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: Omit<User, "updatedAt">;
}

// --- Extension Messages ---

export interface ExtensionMessage {
  type: "ENHANCE" | "AUTH_STATUS" | "SETTINGS_UPDATE";
  payload: unknown;
}

export interface ExtensionEnhanceMessage extends ExtensionMessage {
  type: "ENHANCE";
  payload: EnhanceRequest;
}
