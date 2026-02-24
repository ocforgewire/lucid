// ============================================
// LUCID API — Billing Routes (Stripe)
// POST /billing/checkout, POST /billing/webhook, GET /billing/portal
// ============================================

import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users, subscriptions } from "../db/schema";
import { requireAuth } from "../middleware/auth";
import {
  createCheckoutSession,
  createPortalSession,
  constructWebhookEvent,
} from "../services/stripe";
import type { Plan } from "@lucid/shared";
import type { AppEnv } from "../types";

const billing = new Hono<AppEnv>();

const VALID_PAID_PLANS: Plan[] = ["pro", "team", "business", "api"];

// ── POST /billing/checkout ────────────────────

billing.post("/checkout", requireAuth, async (c) => {
  const user = c.get("user");
  const body = await c.req.json<{
    plan?: string;
    successUrl?: string;
    cancelUrl?: string;
  }>();

  const { plan, successUrl, cancelUrl } = body;

  if (!plan || !VALID_PAID_PLANS.includes(plan as Plan)) {
    return c.json(
      { error: "Invalid plan. Must be: pro, team, business, or api" },
      400
    );
  }

  if (!successUrl || !cancelUrl) {
    return c.json({ error: "successUrl and cancelUrl are required" }, 400);
  }

  // Get full user record for stripeCustomerId
  const userRows = await db
    .select()
    .from(users)
    .where(eq(users.id, user.userId))
    .limit(1);

  if (userRows.length === 0) {
    return c.json({ error: "User not found" }, 404);
  }

  const fullUser = userRows[0];

  try {
    const checkoutUrl = await createCheckoutSession({
      userId: user.userId,
      email: user.email,
      plan: plan as Plan,
      successUrl,
      cancelUrl,
      stripeCustomerId: fullUser.stripeCustomerId,
    });

    return c.json({ url: checkoutUrl });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return c.json({ error: "Failed to create checkout session" }, 500);
  }
});

// ── POST /billing/webhook ─────────────────────
// Stripe sends raw body, so we must read it as text.
// This endpoint is NOT authenticated via JWT — Stripe uses webhook signatures.

billing.post("/webhook", async (c) => {
  const signature = c.req.header("stripe-signature");

  if (!signature) {
    return c.json({ error: "Missing stripe-signature header" }, 400);
  }

  const rawBody = await c.req.text();

  let event;
  try {
    event = constructWebhookEvent(rawBody, signature);
  } catch (error) {
    console.error("Webhook signature verification failed:", error);
    return c.json({ error: "Invalid webhook signature" }, 400);
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as {
        metadata?: { userId?: string; plan?: string };
        customer?: string;
        subscription?: string;
      };

      const userId = session.metadata?.userId;
      const plan = session.metadata?.plan as Plan | undefined;
      const stripeCustomerId = session.customer as string | undefined;
      const stripeSubscriptionId = session.subscription as
        | string
        | undefined;

      if (!userId || !plan) {
        console.error("Checkout session missing metadata:", session);
        break;
      }

      // Update user plan and stripeCustomerId
      await db
        .update(users)
        .set({
          plan,
          stripeCustomerId: stripeCustomerId ?? undefined,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      // Create subscription record
      if (stripeSubscriptionId) {
        const now = new Date();
        const periodEnd = new Date(now);
        periodEnd.setMonth(periodEnd.getMonth() + 1);

        await db.insert(subscriptions).values({
          userId,
          stripeSubscriptionId,
          plan,
          status: "active",
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        });
      }

      console.log(`User ${userId} upgraded to ${plan}`);
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as {
        id: string;
        status: string;
        current_period_start: number;
        current_period_end: number;
      };

      const status = sub.status;

      // Update subscription record
      await db
        .update(subscriptions)
        .set({
          status: status as
            | "active"
            | "past_due"
            | "canceled"
            | "trialing",
          currentPeriodStart: new Date(sub.current_period_start * 1000),
          currentPeriodEnd: new Date(sub.current_period_end * 1000),
        })
        .where(eq(subscriptions.stripeSubscriptionId, sub.id));

      console.log(`Subscription ${sub.id} updated: ${status}`);
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as { id: string };

      // Find the subscription to get the userId
      const subRows = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.stripeSubscriptionId, sub.id))
        .limit(1);

      if (subRows.length > 0) {
        const subscription = subRows[0];

        // Downgrade user to free
        await db
          .update(users)
          .set({ plan: "free", updatedAt: new Date() })
          .where(eq(users.id, subscription.userId));

        // Update subscription status
        await db
          .update(subscriptions)
          .set({ status: "canceled" })
          .where(eq(subscriptions.stripeSubscriptionId, sub.id));

        console.log(`User ${subscription.userId} downgraded to free`);
      }

      break;
    }

    default:
      console.log(`Unhandled webhook event: ${event.type}`);
  }

  return c.json({ received: true });
});

// ── GET /billing/portal ───────────────────────

billing.get("/portal", requireAuth, async (c) => {
  const user = c.get("user");
  const returnUrl =
    c.req.query("returnUrl") ||
    process.env.APP_URL ||
    "http://localhost:3000";

  // Get user's stripeCustomerId
  const userRows = await db
    .select({ stripeCustomerId: users.stripeCustomerId })
    .from(users)
    .where(eq(users.id, user.userId))
    .limit(1);

  if (userRows.length === 0) {
    return c.json({ error: "User not found" }, 404);
  }

  const stripeCustomerId = userRows[0].stripeCustomerId;

  if (!stripeCustomerId) {
    return c.json(
      { error: "No billing account found. Please subscribe first." },
      400
    );
  }

  try {
    const portalUrl = await createPortalSession(
      stripeCustomerId,
      returnUrl
    );
    return c.json({ url: portalUrl });
  } catch (error) {
    console.error("Stripe portal error:", error);
    return c.json(
      { error: "Failed to create billing portal session" },
      500
    );
  }
});

export default billing;
