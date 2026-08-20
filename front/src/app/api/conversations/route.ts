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

  const plan = session.user.plan || "free";
  const limit = PLAN_LIMITS[plan];

  const count = await prisma.conversation.count({
    where: { userId: session.user.id },
  });

  if (count >= limit) {
    return NextResponse.json(
      {
        error: "conversation_limit_reached",
        message: `Has alcanzado el límite de ${limit} conversaciones para tu plan ${plan}.`,
        plan,
        limit,
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
