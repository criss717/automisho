import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;

  const conversation = await prisma.conversation.findFirst({
    where: {
      id,
      userId: session.user.id,
    },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          role: true,
          content: true,
          createdAt: true,
        },
      },
    },
  });

  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(conversation);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;

  const conversation = await prisma.conversation.findFirst({
    where: {
      id,
      userId: session.user.id,
    },
  });

  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Explicit cascade: delete messages first (DB also has onDelete Cascade, but explicit ensures count drops reliably)
  try {
    await prisma.message.deleteMany({ where: { conversationId: id } });
  } catch (e) {
    console.warn("[conversations] DELETE message cascade warning", e);
  }
  await prisma.conversation.delete({ where: { id } });

  const remaining = await prisma.conversation.count({ where: { userId: session.user.id } });
  console.log(`[conversations] DELETE ${id} for user ${session.user.id} → remaining ${remaining}`);

  return new Response(null, { status: 204 });
}
