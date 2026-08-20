"use client";

interface UsageStatsProps {
  plan: "free" | "premium" | "pro";
  conversationCount: number;
  messageCount: number;
  memberSince: string;
}

const PLAN_LIMITS: Record<string, number> = {
  free: 5,
  premium: 20,
  pro: Infinity,
};

export default function UsageStats({
  plan,
  conversationCount,
  messageCount,
  memberSince,
}: UsageStatsProps) {
  const limit = PLAN_LIMITS[plan];
  const isLimited = limit !== Infinity;
  const usagePercent = isLimited ? Math.min((conversationCount / limit) * 100, 100) : 0;

  return (
    <div className="glass-card">
      <p className="text-xs uppercase tracking-wider text-mint-glow/60 mb-5">Uso</p>

      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-mist-gray/70">Conversaciones</span>
            <span className="text-pure-light">
              {isLimited ? `${conversationCount} / ${limit}` : `${conversationCount}`}
            </span>
          </div>
          {isLimited && (
            <div className="h-2 bg-midnight-tide rounded-full overflow-hidden">
              <div
                className="h-full bg-mint-glow/70 rounded-full transition-all"
                style={{ width: `${usagePercent}%` }}
              />
            </div>
          )}
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-mist-gray/70">Mensajes enviados</span>
          <span className="text-pure-light">{messageCount}</span>
        </div>

        <div className="pt-4 border-t border-midnight-tide">
          <div className="flex justify-between text-sm">
            <span className="text-mist-gray/70">Miembro desde</span>
            <span className="text-pure-light">{memberSince}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
