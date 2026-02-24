// ============================================
// LUCID API — Auth Middleware (JWT Verification)
// ============================================

import type { Context, Next } from "hono";
import { jwtVerify } from "jose";
import type { AuthTokenPayload } from "@lucid/shared";
import type { AppEnv } from "../types";

const JWT_SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || "lucid-dev-secret-change-in-production"
);

export async function requireAuth(
  c: Context<AppEnv>,
  next: Next
): Promise<Response | void> {
  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Missing or invalid Authorization header" }, 401);
  }

  const token = authHeader.slice(7);

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);

    const user: AuthTokenPayload = {
      userId: payload.userId as string,
      email: payload.email as string,
      plan: payload.plan as AuthTokenPayload["plan"],
    };

    c.set("user", user);
    await next();
  } catch {
    return c.json({ error: "Invalid or expired token" }, 401);
  }
}

export async function signToken(payload: AuthTokenPayload): Promise<string> {
  const { SignJWT } = await import("jose");

  return new SignJWT({
    userId: payload.userId,
    email: payload.email,
    plan: payload.plan,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET_KEY);
}
