import { auth } from "@/lib/auth";
import { getStripe, STRIPE_PLANS, type PlanKey } from "@/lib/stripe";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();

  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { plan } = (await req.json()) as { plan: PlanKey };

  if (!plan || !(plan in STRIPE_PLANS)) {
    return new Response("Invalid plan", { status: 400 });
  }

  const origin = req.headers.get("origin") || process.env.NEXTAUTH_URL!;

  const stripe = getStripe();

  // Create or retrieve Stripe customer
  let customerId = session.user.stripeCustomerId;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: session.user.email!,
      name: session.user.name || undefined,
      metadata: { userId: session.user.id },
    });
    customerId = customer.id;

    // Update user with Stripe customer ID
    const { prisma } = await import("@/lib/prisma");
    await prisma.user.update({
      where: { id: session.user.id },
      data: { stripeCustomerId: customerId },
    });
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [
      {
        price: STRIPE_PLANS[plan],
        quantity: 1,
      },
    ],
    success_url: `${origin}/dashboard?success=true`,
    cancel_url: `${origin}/pricing?canceled=true`,
    metadata: {
      userId: session.user.id,
      plan,
    },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
