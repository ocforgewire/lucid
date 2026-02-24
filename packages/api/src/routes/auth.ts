// ============================================
// LUCID API — Auth Routes
// POST /auth/signup, POST /auth/login, GET /auth/me
// ============================================

import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users, personalizationProfiles } from "../db/schema";
import { requireAuth, signToken } from "../middleware/auth";
import { isValidEmail, isValidPassword } from "@lucid/shared";
import type { AuthTokenPayload } from "@lucid/shared";
import type { AppEnv } from "../types";

const auth = new Hono<AppEnv>();

// ── POST /auth/signup ─────────────────────────

auth.post("/signup", async (c) => {
  const body = await c.req.json<{
    email?: string;
    password?: string;
    name?: string;
  }>();

  const { email, password, name } = body;

  if (!email || !isValidEmail(email)) {
    return c.json({ error: "Invalid email address" }, 400);
  }

  if (!password || !isValidPassword(password)) {
    return c.json(
      { error: "Password must be at least 8 characters" },
      400
    );
  }

  if (!name || name.trim().length === 0) {
    return c.json({ error: "Name is required" }, 400);
  }

  // Check if email is already registered
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  if (existing.length > 0) {
    return c.json({ error: "Email already registered" }, 409);
  }

  // Hash password
  const passwordHash = await Bun.password.hash(password, {
    algorithm: "bcrypt",
    cost: 12,
  });

  // Insert user
  const [newUser] = await db
    .insert(users)
    .values({
      email: email.toLowerCase(),
      passwordHash,
      name: name.trim(),
      plan: "free",
    })
    .returning();

  // Create default personalization profile
  await db.insert(personalizationProfiles).values({
    userId: newUser.id,
  });

  // Generate JWT
  const tokenPayload: AuthTokenPayload = {
    userId: newUser.id,
    email: newUser.email,
    plan: "free",
  };

  const token = await signToken(tokenPayload);

  return c.json(
    {
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        plan: newUser.plan,
        stripeCustomerId: newUser.stripeCustomerId,
        createdAt: newUser.createdAt,
      },
    },
    201
  );
});

// ── POST /auth/login ──────────────────────────

auth.post("/login", async (c) => {
  const body = await c.req.json<{
    email?: string;
    password?: string;
  }>();

  const { email, password } = body;

  if (!email || !isValidEmail(email)) {
    return c.json({ error: "Invalid email address" }, 400);
  }

  if (!password) {
    return c.json({ error: "Password is required" }, 400);
  }

  // Find user by email
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  if (rows.length === 0) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  const user = rows[0];

  // Verify password
  const valid = await Bun.password.verify(password, user.passwordHash);
  if (!valid) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  // Generate JWT
  const tokenPayload: AuthTokenPayload = {
    userId: user.id,
    email: user.email,
    plan: user.plan as AuthTokenPayload["plan"],
  };

  const token = await signToken(tokenPayload);

  return c.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      stripeCustomerId: user.stripeCustomerId,
      createdAt: user.createdAt,
    },
  });
});

// ── GET /auth/me ──────────────────────────────

auth.get("/me", requireAuth, async (c) => {
  const authUser = c.get("user");

  const rows = await db
    .select()
    .from(users)
    .where(eq(users.id, authUser.userId))
    .limit(1);

  if (rows.length === 0) {
    return c.json({ error: "User not found" }, 404);
  }

  const user = rows[0];

  return c.json({
    id: user.id,
    email: user.email,
    name: user.name,
    plan: user.plan,
    stripeCustomerId: user.stripeCustomerId,
    createdAt: user.createdAt,
  });
});

export default auth;
