// ============================================
// LUCID — Shared Constants
// ============================================

export const PLAN_LIMITS = {
  free: {
    enhancementsPerMonth: 20,
    models: ["chatgpt"] as const,
    personalization: false,
    analytics: false,
    teamFeatures: false,
    apiAccess: false,
    maxTeamSeats: 0,
  },
  pro: {
    enhancementsPerMonth: 1000,
    models: ["chatgpt", "claude", "gemini"] as const,
    personalization: true,
    analytics: true,
    teamFeatures: false,
    apiAccess: false,
    maxTeamSeats: 0,
  },
  team: {
    enhancementsPerMonth: 5000,
    models: ["chatgpt", "claude", "gemini"] as const,
    personalization: true,
    analytics: true,
    teamFeatures: true,
    apiAccess: false,
    maxTeamSeats: 5,
  },
  business: {
    enhancementsPerMonth: 20000,
    models: ["chatgpt", "claude", "gemini"] as const,
    personalization: true,
    analytics: true,
    teamFeatures: true,
    apiAccess: true,
    maxTeamSeats: 15,
  },
  api: {
    enhancementsPerMonth: 50000,
    models: ["chatgpt", "claude", "gemini"] as const,
    personalization: true,
    analytics: true,
    teamFeatures: false,
    apiAccess: true,
    maxTeamSeats: 0,
  },
} as const;

export const RATE_LIMITS = {
  free: { requestsPerMinute: 5, requestsPerDay: 20 },
  pro: { requestsPerMinute: 30, requestsPerDay: 1000 },
  team: { requestsPerMinute: 60, requestsPerDay: 5000 },
  business: { requestsPerMinute: 120, requestsPerDay: 20000 },
  api: { requestsPerMinute: 200, requestsPerDay: 50000 },
} as const;

export const ENHANCEMENT_TIME_SAVED_MINUTES = 2; // avg minutes saved per enhancement

export const PERSONALIZATION_COLD_START_THRESHOLD = 50; // enhancements before full personalization kicks in

export const MODEL_DISPLAY_NAMES = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  gemini: "Gemini",
} as const;

export const MODE_DISPLAY_NAMES = {
  enhance: "Enhance",
  expand: "Expand",
  refine: "Refine",
  simplify: "Simplify",
} as const;

export const API_VERSION = "v1";
