import Stripe from "stripe";
import { getStripe, PRICE_TO_PLAN } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

export async function POST(req: Request) {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("[webhook] Missing STRIPE_WEBHOOK_SECRET env");
    return new Response("Missing STRIPE_WEBHOOK_SECRET", { status: 500 });
  }

  const body = await req.text();
  const headersList = await headers();
  const sig = headersList.get("stripe-signature");

  if (!sig) {
    return new Response("Missing signature", { status: 400 });
  }

  let event: Stripe.Event;

  const stripe = getStripe();

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const plan = session.metadata?.plan as "premium" | "pro";

        if (!userId || !plan) {
          console.warn("[webhook] checkout.session.completed missing metadata", { userId, plan, sessionId: session.id });
          break;
        }

        // Idempotent: if plan already equals, still update but no duplicate creation
        try {
          const existing = await prisma.user.findUnique({ where: { id: userId } });
          if (existing && existing.plan === plan && existing.stripeCustomerId === (session.customer as string)) {
            console.log(`[webhook] checkout.session.completed idempotent skip for ${userId} plan ${plan}`);
          } else {
            await prisma.user.update({
              where: { id: userId },
              data: {
                plan,
                stripeCustomerId: session.customer as string,
              },
            });
            console.log(`[webhook] updated user ${userId} to plan ${plan}`);
          }
        } catch (e) {
          // If user not found, warn
          console.warn("[webhook] checkout.session.completed user update failed", e);
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const priceId = subscription.items.data[0]?.price.id;
        const plan = priceId ? PRICE_TO_PLAN[priceId] : undefined;

        if (!priceId || !plan) {
          console.warn(`[webhook] Unknown priceId ${priceId} for customer ${customerId}, skipping update`);
          break;
        }

        try {
          await prisma.user.update({
            where: { stripeCustomerId: customerId },
            data: { plan },
          });
          console.log(`[webhook] subscription.updated ${customerId} → ${plan}`);
        } catch (e) {
          console.warn("[webhook] subscription.updated update failed", e);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        try {
          await prisma.user.update({
            where: { stripeCustomerId: customerId },
            data: { plan: "free" },
          });
          console.log(`[webhook] subscription.deleted ${customerId} → free`);
        } catch (e) {
          console.warn("[webhook] subscription.deleted update failed", e);
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        console.log(`[webhook] invoice.paid renewal for customer: ${customerId}`);
        // Do not downgrade; optional: ensure user still premium/pro
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        console.warn("[webhook] Payment failed for customer:", customerId);
        break;
      }

      case "customer.subscription.past_due": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        console.warn("[webhook] Subscription past_due for customer:", customerId);
        break;
      }
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
    return new Response("Webhook handler failed", { status: 500 });
  }

  return new Response(null, { status: 200 });
}
