// ============================================
// LUCID API — CORS Configuration
// ============================================

import { cors } from "hono/cors";

export function createCorsMiddleware() {
  const originsEnv = process.env.CORS_ORIGINS || "http://localhost:3000";
  const origins = originsEnv.split(",").map((o) => o.trim());

  return cors({
    origin: origins,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    exposeHeaders: [
      "X-RateLimit-Limit",
      "X-RateLimit-Remaining",
      "X-RateLimit-Reset",
    ],
    maxAge: 86400,
    credentials: true,
  });
}
