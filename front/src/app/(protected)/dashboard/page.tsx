import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PlanCard from "@/components/dashboard/PlanCard";
import UsageStats from "@/components/dashboard/UsageStats";
import SettingsPanel from "@/components/dashboard/SettingsPanel";
import DgtLookupInput from "@/components/dashboard/DgtLookupInput";
import { DashboardBlobs, DashboardHeader, DashboardStaggerGrid } from "@/components/dashboard/DashboardGrid";
import DashboardSuccessRefresh from "@/components/dashboard/DashboardSuccessRefresh";
import DgtHistoryCards from "@/components/dashboard/DgtHistoryCards";
import { Suspense } from "react";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) return null;

  const [conversationCount, messageCount, dbUser] = await Promise.all([
    prisma.conversation.count({ where: { userId: session.user.id } }),
    prisma.message.count({
      where: { conversation: { userId: session.user.id } },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { createdAt: true, plan: true },
    }),
  ]);

  const memberDate = dbUser?.createdAt
    ? new Date(dbUser.createdAt).toLocaleDateString("es-ES", {
        year: "numeric",
        month: "long",
      })
    : "Desconocido";

  // Use DB plan, not session stale (session JWT may lag behind webhook/refresh)
  const currentPlan = (dbUser?.plan as "free" | "premium" | "pro") || (session.user.plan as "free" | "premium" | "pro") || "free";

  return (
    <div className="relative h-full overflow-y-auto overflow-x-hidden">
      <DashboardBlobs />
      <div className="relative max-w-6xl mx-auto px-6 md:px-8 py-8">
        <Suspense fallback={null}>
          <DashboardSuccessRefresh />
        </Suspense>
        <DashboardHeader>
          <h1 className="text-2xl text-pure-light font-light mb-8">
            Dashboard
          </h1>
        </DashboardHeader>

        <DashboardStaggerGrid>
          <PlanCard currentPlan={currentPlan} />
          <UsageStats
            plan={currentPlan}
            conversationCount={conversationCount}
            messageCount={messageCount}
            memberSince={memberDate}
          />
          <DgtLookupInput />
          <SettingsPanel user={session.user} />
        </DashboardStaggerGrid>

        <DgtHistoryCards />
      </div>
    </div>
  );
}
