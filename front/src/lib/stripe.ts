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

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing ${key} env`);
  return val;
}

export const STRIPE_PLANS = {
  premium: requireEnv("STRIPE_PREMIUM_PRICE_ID"),
  pro: requireEnv("STRIPE_PRO_PRICE_ID"),
} as const;

export type PlanKey = keyof typeof STRIPE_PLANS;

export const PRICE_TO_PLAN: Record<string, PlanKey> = {
  [process.env.STRIPE_PREMIUM_PRICE_ID as string]: "premium",
  [process.env.STRIPE_PRO_PRICE_ID as string]: "pro",
};
