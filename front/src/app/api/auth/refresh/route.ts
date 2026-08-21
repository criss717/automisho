import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!dbUser) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    // Fallback: if DB still free but Stripe customer exists, reconcile from Stripe API
    // This covers local dev where webhook doesn't arrive (no stripe CLI).
    if (dbUser.plan === "free" && dbUser.stripeCustomerId) {
      try {
        const { getStripe, PRICE_TO_PLAN } = await import("@/lib/stripe");
        const stripe = getStripe();
        // List active / trialing subscriptions for this customer
        const subs = await stripe.subscriptions.list({
          customer: dbUser.stripeCustomerId,
          status: "all",
          limit: 5,
        });
        const active = subs.data.find((s) => s.status === "active" || s.status === "trialing");
        if (active) {
          const priceId = active.items.data[0]?.price?.id;
          const planFromStripe = priceId ? (PRICE_TO_PLAN[priceId] as "premium" | "pro" | undefined) : undefined;
          // Fallback: infer from metadata or default to premium if active but unknown price
          const resolvedPlan: "premium" | "pro" = (planFromStripe as "premium" | "pro") || "premium";
          if (resolvedPlan !== (dbUser.plan as string)) {
            await prisma.user.update({
              where: { id: dbUser.id },
              data: { plan: resolvedPlan },
            });
            console.log(`[auth] refresh reconciled via Stripe: ${dbUser.id} free → ${resolvedPlan} (customer ${dbUser.stripeCustomerId}, sub ${active.id})`);
            return Response.json({ ok: true, plan: resolvedPlan, reconciled: true });
          }
        }
      } catch (e) {
        // Stripe not configured or API error — swallow and fall through as free
        console.warn("[auth] refresh stripe reconcile skipped:", (e as Error).message);
      }
    }

    // Log only when plan is not free or when reconciled; avoid spam of "free" every 2s
    if (dbUser.plan !== "free") {
      console.log(`[auth] refresh plan: ${dbUser.plan} for user ${session.user.id}`);
    }

    // The jwt callback will refresh token on next request; this endpoint confirms DB state
    return Response.json({ ok: true, plan: dbUser.plan });
  } catch (err) {
    console.error("[auth] refresh error:", err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
