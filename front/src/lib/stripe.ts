import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    _stripe = new Stripe(apiKey, { typescript: true });
  }
  return _stripe;
}

function getEnv(key: string, fallback: string = ""): string {
  return process.env[key] || fallback;
}

export const STRIPE_PLANS = {
  premium: getEnv("STRIPE_PREMIUM_PRICE_ID", "price_premium_placeholder"),
  pro: getEnv("STRIPE_PRO_PRICE_ID", "price_pro_placeholder"),
} as const;

export type PlanKey = keyof typeof STRIPE_PLANS;

export const PRICE_TO_PLAN: Record<string, PlanKey> = {
  [getEnv("STRIPE_PREMIUM_PRICE_ID", "price_premium_placeholder")]: "premium",
  [getEnv("STRIPE_PRO_PRICE_ID", "price_pro_placeholder")]: "pro",
};
