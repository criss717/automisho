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
import Link from "next/link";

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
    <div className="relative h-full overflow-y-auto overflow-x-hidden bg-parchment w-full text-charcoal">
      <DashboardBlobs />
      <div className="relative w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <Suspense fallback={null}>
          <DashboardSuccessRefresh />
        </Suspense>

        <DashboardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-mist">
            <div>
              <span className="text-xs uppercase tracking-widest text-ash font-medium mb-1 block">
                Área Personal
              </span>
              <h1 className="font-ppmondwest text-3xl sm:text-4xl text-graphite font-normal tracking-tight">
                Mi Cuenta & Control
              </h1>
              <p className="text-xs sm:text-sm text-ash mt-1 max-w-md">
                Gestiona tu suscripción, revisa cuotas de uso y accede al portal de consulta de matrículas DGT.
              </p>
            </div>

            <Link
              href="/chat"
              className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs sm:text-sm self-start sm:self-auto"
            >
              <span>💬 Abrir Copilot Workspace</span>
              <span>→</span>
            </Link>
          </div>
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

        <div className="pt-4">
          <DgtHistoryCards />
        </div>
      </div>
    </div>
  );
}
