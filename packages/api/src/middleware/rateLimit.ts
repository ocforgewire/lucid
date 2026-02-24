// ============================================
// LUCID API — In-Memory Rate Limiter
// ============================================

import type { Context, Next } from "hono";
import { RATE_LIMITS } from "@lucid/shared";
import type { Plan } from "@lucid/shared";
import type { AppEnv } from "../types";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const minuteWindows = new Map<string, RateLimitEntry>();
const dayWindows = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of minuteWindows) {
    if (entry.resetAt <= now) minuteWindows.delete(key);
  }
  for (const [key, entry] of dayWindows) {
    if (entry.resetAt <= now) dayWindows.delete(key);
  }
}, 5 * 60 * 1000);

function checkWindow(
  windows: Map<string, RateLimitEntry>,
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = windows.get(key);

  if (!entry || entry.resetAt <= now) {
    const resetAt = now + windowMs;
    windows.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: limit - entry.count,
    resetAt: entry.resetAt,
  };
}

export async function rateLimit(
  c: Context<AppEnv>,
  next: Next
): Promise<Response | void> {
  const user = c.get("user");

  if (!user) {
    return c.json({ error: "Authentication required for rate limiting" }, 401);
  }

  const plan = user.plan as Plan;
  const limits = RATE_LIMITS[plan];

  if (!limits) {
    return c.json({ error: "Invalid plan" }, 400);
  }

  // Check per-minute limit
  const minuteKey = `${user.userId}:min`;
  const minuteResult = checkWindow(
    minuteWindows,
    minuteKey,
    limits.requestsPerMinute,
    60 * 1000
  );

  if (!minuteResult.allowed) {
    c.header("X-RateLimit-Limit", String(limits.requestsPerMinute));
    c.header("X-RateLimit-Remaining", "0");
    c.header(
      "X-RateLimit-Reset",
      String(Math.ceil(minuteResult.resetAt / 1000))
    );
    c.header(
      "Retry-After",
      String(Math.ceil((minuteResult.resetAt - Date.now()) / 1000))
    );
    return c.json(
      {
        error: "Rate limit exceeded",
        retryAfter: Math.ceil((minuteResult.resetAt - Date.now()) / 1000),
      },
      429
    );
  }

  // Check per-day limit
  const dayKey = `${user.userId}:day`;
  const dayResult = checkWindow(
    dayWindows,
    dayKey,
    limits.requestsPerDay,
    24 * 60 * 60 * 1000
  );

  if (!dayResult.allowed) {
    // Rollback minute count since we're rejecting
    const minuteEntry = minuteWindows.get(minuteKey);
    if (minuteEntry) minuteEntry.count--;

    c.header("X-RateLimit-Limit", String(limits.requestsPerDay));
    c.header("X-RateLimit-Remaining", "0");
    c.header(
      "X-RateLimit-Reset",
      String(Math.ceil(dayResult.resetAt / 1000))
    );
    c.header(
      "Retry-After",
      String(Math.ceil((dayResult.resetAt - Date.now()) / 1000))
    );
    return c.json(
      {
        error: "Daily rate limit exceeded",
        retryAfter: Math.ceil((dayResult.resetAt - Date.now()) / 1000),
      },
      429
    );
  }

  c.header("X-RateLimit-Limit", String(limits.requestsPerMinute));
  c.header("X-RateLimit-Remaining", String(minuteResult.remaining));
  c.header(
    "X-RateLimit-Reset",
    String(Math.ceil(minuteResult.resetAt / 1000))
  );

  await next();
}
