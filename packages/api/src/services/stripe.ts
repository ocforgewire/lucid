// ============================================
// LUCID API — Stripe Service
// ============================================

import Stripe from "stripe";
import type { Plan } from "@lucid/shared";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

let stripeClient: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeClient) {
    if (!stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY environment variable is required");
    }
    stripeClient = new Stripe(stripeSecretKey, {
      apiVersion: "2025-01-27.acacia" as Stripe.LatestApiVersion,
    });
  }
  return stripeClient;
}

// Map plans to Stripe price IDs (set via env vars)
const PLAN_PRICE_MAP: Record<string, string | undefined> = {
  pro: process.env.STRIPE_PRICE_PRO,
  team: process.env.STRIPE_PRICE_TEAM,
  business: process.env.STRIPE_PRICE_BUSINESS,
  api: process.env.STRIPE_PRICE_API,
};

export async function createCheckoutSession(params: {
  userId: string;
  email: string;
  plan: Plan;
  successUrl: string;
  cancelUrl: string;
  stripeCustomerId?: string | null;
}): Promise<string> {
  const stripe = getStripe();
  const priceId = PLAN_PRICE_MAP[params.plan];

  if (!priceId) {
    throw new Error(`No Stripe price configured for plan: ${params.plan}`);
  }

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: {
      userId: params.userId,
      plan: params.plan,
    },
  };

  if (params.stripeCustomerId) {
    sessionParams.customer = params.stripeCustomerId;
  } else {
    sessionParams.customer_email = params.email;
  }

  const session = await stripe.checkout.sessions.create(sessionParams);

  if (!session.url) {
    throw new Error("Stripe checkout session URL not returned");
  }

  return session.url;
}

export async function createPortalSession(
  stripeCustomerId: string,
  returnUrl: string
): Promise<string> {
  const stripe = getStripe();

  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: returnUrl,
  });

  return session.url;
}

export function constructWebhookEvent(
  body: string,
  signature: string
): Stripe.Event {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET environment variable is required");
  }

  return stripe.webhooks.constructEvent(body, signature, webhookSecret);
}

export { getStripe };
