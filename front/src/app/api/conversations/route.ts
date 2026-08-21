import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { ConversationBody } from "@/lib/validators";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const PLAN_LIMITS: Record<string, number> = {
  free: 5,
  premium: 20,
  pro: Infinity,
};

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const conversations = await prisma.conversation.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    take: 20,
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { messages: true } },
    },
  });

  return NextResponse.json(conversations);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!checkRateLimit(req, (session.user as unknown as { plan?: string }).plan)) {
    return rateLimitResponse();
  }

  // Prefer DB plan (session JWT may be stale after Stripe webhook/refresh)
  let plan = (session.user.plan as string) || "free";
  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { plan: true },
    });
    if (dbUser?.plan) plan = dbUser.plan;
  } catch (e) {
    console.warn("[conversations] POST plan lookup failed, using session plan", e);
  }
  const limit = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;

  const count = await prisma.conversation.count({
    where: { userId: session.user.id },
  });

  console.log(`[conversations] POST check user=${session.user.id} plan=${plan} count=${count} limit=${limit}`);

  if (count >= limit) {
    return NextResponse.json(
      {
        error: "conversation_limit_reached",
        message: `Has alcanzado el límite de ${limit} conversaciones para tu plan ${plan}. Borra alguna conversación o mejora tu plan.`,
        plan,
        limit,
        count,
      },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = ConversationBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const title = parsed.data.title || "Nueva conversación";

  const conversation = await prisma.conversation.create({
    data: {
      userId: session.user.id,
      title,
    },
    select: {
      id: true,
      title: true,
      createdAt: true,
    },
  });

  return NextResponse.json(conversation, { status: 201 });
}
