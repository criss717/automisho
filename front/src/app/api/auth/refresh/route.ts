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

    console.log(`[auth] refresh plan: ${dbUser.plan} for user ${session.user.id}`);

    // The jwt callback will refresh token on next request; this endpoint confirms DB state
    return Response.json({ ok: true, plan: dbUser.plan });
  } catch (err) {
    console.error("[auth] refresh error:", err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
