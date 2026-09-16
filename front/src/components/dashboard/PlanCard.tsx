"use client";

import { useState } from "react";

interface PlanCardProps {
  currentPlan: "free" | "premium" | "pro";
}

const planDetails = {
  free: { name: "Gratis", price: "€0", period: "siempre" },
  pro: { name: "Pro", price: "€25", period: "/mes" },
  premium: { name: "Premium", price: "€35", period: "/mes" },
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

  const details = planDetails[currentPlan] || planDetails.free;

  return (
    <div className="card p-6 bg-paper border border-mist shadow-subtle rounded-2xl">
      <p className="text-xs uppercase tracking-wider text-ash mb-3 font-medium">Tu plan actual</p>
      <h3 className="font-ppmondwest text-2xl text-graphite font-normal mb-1">{details.name}</h3>
      <div className="flex items-baseline gap-1.5 mb-6">
        <span className="font-ppmondwest text-4xl text-graphite font-normal">{details.price}</span>
        <span className="text-sm text-ash font-medium">{details.period}</span>
      </div>

      <div className="space-y-3">
        {currentPlan === "free" && (
          <>
            <button
              onClick={() => handleUpgrade("pro")}
              disabled={loading === "pro"}
              className="btn-primary w-full py-2.5 justify-center text-sm font-medium"
            >
              {loading === "pro" ? "Redirigiendo..." : "Subir a Pro (25€/mes)"}
            </button>
            <button
              onClick={() => handleUpgrade("premium")}
              disabled={loading === "premium"}
              className="btn-secondary w-full py-2.5 justify-center text-sm font-medium"
            >
              {loading === "premium" ? "Redirigiendo..." : "Subir a Premium (35€/mes)"}
            </button>
          </>
        )}

        {currentPlan === "pro" && (
          <>
            <button
              onClick={() => handleUpgrade("premium")}
              disabled={loading === "premium"}
              className="btn-primary w-full py-2.5 justify-center text-sm font-medium"
            >
              {loading === "premium" ? "Redirigiendo..." : "Subir a Premium (35€/mes)"}
            </button>
            <button
              onClick={handleManage}
              className="btn-secondary w-full py-2.5 justify-center text-sm font-medium"
            >
              Gestionar suscripción
            </button>
          </>
        )}

        {currentPlan === "premium" && (
          <button
            onClick={handleManage}
            className="btn-secondary w-full py-2.5 justify-center text-sm font-medium"
          >
            Gestionar suscripción
          </button>
        )}
      </div>
    </div>
  );
}
