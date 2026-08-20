import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PlanCard from "@/components/dashboard/PlanCard";
import UsageStats from "@/components/dashboard/UsageStats";
import SettingsPanel from "@/components/dashboard/SettingsPanel";
import DgtLookupInput from "@/components/dashboard/DgtLookupInput";
import { DashboardBlobs, DashboardHeader, DashboardStaggerGrid } from "@/components/dashboard/DashboardGrid";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) return null;

  const [conversationCount, messageCount, memberSince] = await Promise.all([
    prisma.conversation.count({ where: { userId: session.user.id } }),
    prisma.message.count({
      where: { conversation: { userId: session.user.id } },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { createdAt: true },
    }),
  ]);

  const memberDate = memberSince?.createdAt
    ? new Date(memberSince.createdAt).toLocaleDateString("es-ES", {
        year: "numeric",
        month: "long",
      })
    : "Desconocido";

  return (
    <div className="relative h-full overflow-y-auto overflow-x-hidden">
      <DashboardBlobs />
      <div className="relative max-w-6xl mx-auto px-8 py-10">
        <DashboardHeader>
          <h1 className="text-2xl text-pure-light font-light mb-8">
            Dashboard
          </h1>
        </DashboardHeader>

        <DashboardStaggerGrid>
          <PlanCard currentPlan={session.user.plan as "free" | "premium" | "pro"} />
          <UsageStats
            plan={session.user.plan as "free" | "premium" | "pro"}
            conversationCount={conversationCount}
            messageCount={messageCount}
            memberSince={memberDate}
          />
          <DgtLookupInput />
          <SettingsPanel user={session.user} />
        </DashboardStaggerGrid>
      </div>
    </div>
  );
}
