// ============================================
// LUCID API — Hono Application Entry Point
// ============================================

import { Hono } from "hono";
import { logger } from "hono/logger";
import { createCorsMiddleware } from "./middleware/cors";
import authRoutes from "./routes/auth";
import enhanceRoutes from "./routes/enhance";
import feedbackRoutes from "./routes/feedback";
import analyticsRoutes from "./routes/analytics";
import profileRoutes from "./routes/profile";
import billingRoutes from "./routes/billing";

const app = new Hono();

// ── Global Middleware ─────────────────────────

app.use("*", logger());
app.use("*", createCorsMiddleware());

// ── Health Check ──────────────────────────────

app.get("/health", (c) => {
  return c.json({
    status: "ok",
    service: "lucid-api",
    version: "0.1.0",
    timestamp: new Date().toISOString(),
  });
});

// ── Mount Routes ──────────────────────────────

app.route("/auth", authRoutes);
app.route("/v1/enhance", enhanceRoutes);
app.route("/v1/feedback", feedbackRoutes);
app.route("/v1/analytics", analyticsRoutes);
app.route("/v1/profile", profileRoutes);
app.route("/billing", billingRoutes);

// ── 404 Fallback ──────────────────────────────

app.notFound((c) => {
  return c.json({ error: "Not found" }, 404);
});

// ── Global Error Handler ──────────────────────

app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json({ error: "Internal server error", detail: err.message }, 500);
});

// ── Start Server ──────────────────────────────

const port = parseInt(process.env.PORT || "3001", 10);

console.log(`
  ╔═══════════════════════════════════════╗
  ║          LUCID API Server             ║
  ║                                       ║
  ║  Port:    ${String(port).padEnd(27)}║
  ║  Env:     ${(process.env.NODE_ENV || "development").padEnd(27)}║
  ╚═══════════════════════════════════════╝
`);

export default {
  port,
  fetch: app.fetch,
};
