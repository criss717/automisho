import { auth } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { prisma } = await import("@/lib/prisma");
  const dbUser = await prisma.user.findUnique({ where: { id: session.user.id } });

  const stripeCustomerId = dbUser?.stripeCustomerId;

  if (!stripeCustomerId) {
    return new Response("No subscription found", { status: 400 });
  }

  const origin = req.headers.get("origin") || process.env.NEXTAUTH_URL!;

  const stripe = getStripe();

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${origin}/dashboard`,
  });

  return NextResponse.json({ url: portalSession.url });
}
