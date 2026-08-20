"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function DashboardSuccessRefresh() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "refreshing" | "done" | "error">("idle");
  const [plan, setPlan] = useState<string | null>(null);

  useEffect(() => {
    const success = searchParams.get("success");
    if (success !== "true") return;

    let attempts = 0;
    const maxAttempts = 5;
    let cancelled = false;

    setStatus("refreshing");

    const poll = async () => {
      attempts += 1;
      try {
        const res = await fetch("/api/auth/refresh", { method: "POST" });
        if (res.ok) {
          const data = await res.json();
          if (data.plan && data.plan !== "free") {
            if (!cancelled) {
              setPlan(data.plan);
              setStatus("done");
              // Remove success param and refresh server data
              const url = new URL(window.location.href);
              url.searchParams.delete("success");
              window.history.replaceState({}, "", url.toString());
              router.refresh();
              return;
            }
          }
        }
      } catch (e) {
        console.error("[DashboardSuccessRefresh] poll error", e);
      }

      if (attempts < maxAttempts && !cancelled) {
        setTimeout(poll, 2000);
      } else if (!cancelled) {
        setStatus("error");
      }
    };

    poll();

    return () => {
      cancelled = true;
    };
  }, [searchParams, router]);

  if (status === "idle") return null;

  return (
    <div className="mb-6">
      {status === "refreshing" && (
        <div className="glass-card flex items-center gap-3 py-3">
          <div className="w-5 h-5 rounded-full border-2 border-mint-glow/30 border-t-mint-glow animate-spin" />
          <span className="text-sm text-mist-gray">Confirmando tu pago…</span>
        </div>
      )}
      {status === "done" && plan && (
        <div className="glass-card border-mint-glow/30 flex items-center gap-3 py-3 bg-mint-glow/5">
          <span className="w-6 h-6 rounded-full bg-mint-glow flex items-center justify-center text-forest-depths">✓</span>
          <span className="text-sm text-pure-light">¡Plan {plan} activado! Gracias por tu suscripción.</span>
        </div>
      )}
      {status === "error" && (
        <div className="glass-card border-amber-400/20 py-3">
          <span className="text-sm text-amber-300">Pago recibido, actualizando tu plan… Si no ves el cambio en unos segundos, recarga la página.</span>
        </div>
      )}
    </div>
  );
}
