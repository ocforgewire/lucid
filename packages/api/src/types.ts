// ============================================
// LUCID API — Hono Environment Types
// ============================================

import type { AuthTokenPayload } from "@lucid/shared";

// Hono environment bindings for type-safe context access
export type AppEnv = {
  Variables: {
    user: AuthTokenPayload;
  };
};
