"use client";

import { useState } from "react";

interface PlanCardProps {
  currentPlan: "free" | "premium" | "pro";
}

const planDetails = {
  free: { name: "Gratis", price: "€0", period: "siempre" },
  premium: { name: "Premium", price: "€4.99", period: "/mes" },
  pro: { name: "Pro", price: "€9.99", period: "/mes" },
};

export default function PlanCard({ currentPlan }: PlanCardProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleUpgrade = async (plan: string) => {
    setLoading(plan);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Checkout error:", err);
    } finally {
      setLoading(null);
    }
  };

  const handleManage = async () => {
    try {
      const res = await fetch("/api/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Portal error:", err);
    }
  };

  const details = planDetails[currentPlan];

  return (
    <div className="glass-card">
      <p className="text-xs uppercase tracking-wider text-mint-glow/60 mb-3">Tu plan actual</p>
      <h3 className="text-xl text-pure-light font-light mb-1">{details.name}</h3>
      <div className="flex items-baseline gap-1 mb-6">
        <span className="text-4xl text-mint-glow font-light">{details.price}</span>
        <span className="text-sm text-mist-gray/60">{details.period}</span>
      </div>

      <div className="space-y-3">
        {currentPlan === "free" && (
          <>
            <button
              onClick={() => handleUpgrade("premium")}
              disabled={loading === "premium"}
              className="w-full py-3 px-4 rounded-lg bg-mint-glow text-forest-depths text-sm font-medium hover:shadow-[0_0_12px_rgba(151,252,215,0.4)] transition-all disabled:opacity-50"
            >
              {loading === "premium" ? "Redirigiendo..." : "Subir a Premium"}
            </button>
            <button
              onClick={() => handleUpgrade("pro")}
              disabled={loading === "pro"}
              className="w-full py-3 px-4 rounded-lg border border-mint-glow/30 text-mint-glow text-sm hover:bg-mint-glow/10 transition-all disabled:opacity-50"
            >
              {loading === "pro" ? "Redirigiendo..." : "Subir a Pro"}
            </button>
          </>
        )}

        {(currentPlan === "premium" || currentPlan === "pro") && (
          <button
            onClick={handleManage}
            className="w-full py-3 px-4 rounded-lg border border-mint-glow/30 text-mint-glow text-sm hover:bg-mint-glow/10 transition-all"
          >
            Gestionar suscripción
          </button>
        )}
      </div>
    </div>
  );
}
