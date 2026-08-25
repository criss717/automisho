"use client";

import { useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import Link from "next/link";

const plans = [
  {
    name: "Gratis",
    price: "€0",
    period: "siempre",
    description: "Para explorar y probar el Copilot",
    features: [
      "5 búsquedas al día",
      "Copilot Workspace con Live Dashboard",
      "Decodificador oficial de matrículas y VINs",
      "Auditoría gratuita de PDFs DGT/ITV que subas al chat",
    ],
    cta: "Empezar Gratis",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "€25",
    period: "/mes",
    description: "Para compradores en búsqueda activa",
    features: [
      "Búsquedas masivas de hasta 50 coches en vivo",
      "1 Informe Completo DGT Oficial (PDF) incluido",
      "Asesor de llamada al vendedor y contraoferta IA",
      "Filtro en tiempo real por portales y combustible",
      "Informes DGT adicionales a 15,99€",
    ],
    cta: "Suscribirse Pro",
    highlighted: false,
  },
  {
    name: "Premium",
    price: "€35",
    period: "/mes",
    description: "Para máxima seguridad y compradores exigentes",
    features: [
      "Búsquedas ilimitadas + Modo Profundo (100 coches)",
      "2 Informes Completos DGT Oficiales (PDF) incluidos",
      "Auditoría profunda de siniestros, ITVs y cargas",
      "Envío directo de informes oficiales a tu email",
      "Informes DGT adicionales a 15,99€",
      "Soporte prioritario y alertas de mercado",
    ],
    cta: "Elegir Premium",
    highlighted: true,
  },
];

export default function Pricing() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });
  const [loading, setLoading] = useState<string | null>(null);

  const handleCheckout = async (plan: string) => {
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

  return (
    <section
      ref={sectionRef}
      id="pricing"
      className="section relative py-20"
    >
      {/* Background accent */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 right-0 w-[400px] h-[400px] bg-shadow-teal/15 rounded-full blur-[100px]" />
      </div>

      {/* Section Header with generous margin to avoid any overlap */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6 }}
        className="text-center relative z-10 mb-16 space-y-2"
      >
        <p className="text-xs uppercase tracking-widest text-mint-glow font-medium">
          Planes y Tarifas
        </p>
        <h2 className="text-3xl sm:text-4xl md:text-5xl text-pure-light font-teodor tracking-tight">
          Elige tu plan
        </h2>
        <p className="text-xs sm:text-sm text-mist-gray/70 max-w-md mx-auto">
          Prueba gratis o desbloquea búsquedas ilimitadas e informes oficiales de la DGT.
        </p>
      </motion.div>

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10 max-w-6xl mx-auto items-stretch">
        {plans.map((plan, index) => (
          <motion.div
            key={plan.name}
            initial={{ opacity: 0, y: 24 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: index * 0.12 }}
            className="relative flex flex-col"
          >
            <div
              className={`h-full flex flex-col justify-between p-8 rounded-3xl transition-all relative ${
                plan.highlighted
                  ? "glass-card border-mint-glow/50 shadow-[0_0_35px_rgba(151,252,215,0.15)] ring-1 ring-mint-glow/30"
                  : "glass-card border-white/8 hover:border-white/20"
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="px-3.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-mint-glow text-forest-depths shadow-md">
                    Más Popular
                  </span>
                </div>
              )}

              {/* Plan Header */}
              <div className="mb-6 pt-1">
                <h3 className="text-xl text-pure-light font-teodor mb-1">
                  {plan.name}
                </h3>
                <p className="text-xs text-mist-gray/70 mb-4 min-h-[32px]">
                  {plan.description}
                </p>
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-4xl sm:text-5xl leading-none text-pure-light font-teodor tracking-tight">
                    {plan.price}
                  </span>
                  <span className="text-xs text-mist-gray/70 font-medium">
                    {plan.period}
                  </span>
                </div>
              </div>

              {/* Features List */}
              <ul className="flex-1 space-y-3 mb-8 border-t border-white/5 pt-6">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2.5 text-xs sm:text-sm text-mist-gray/90 leading-relaxed"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      className="mt-0.5 shrink-0 text-mint-glow"
                    >
                      <path
                        d="M3.5 8 L6.5 11 L12.5 4"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA Button */}
              {plan.name === "Gratis" ? (
                <Link
                  href="/register"
                  className={`w-full py-3.5 px-6 rounded-full text-center text-sm font-medium transition-all ${
                    plan.highlighted
                      ? "bg-mint-glow text-forest-depths hover:shadow-[0_0_15px_rgba(151,252,215,0.4)]"
                      : "border border-mint-glow/40 text-mint-glow hover:bg-mint-glow/10"
                  }`}
                >
                  {plan.cta}
                </Link>
              ) : (
                <button
                  onClick={() => handleCheckout(plan.name.toLowerCase())}
                  disabled={loading === plan.name.toLowerCase()}
                  className={`w-full py-3.5 px-6 rounded-full text-center text-sm font-medium transition-all ${
                    plan.highlighted
                      ? "bg-mint-glow text-forest-depths hover:shadow-[0_0_15px_rgba(151,252,215,0.4)]"
                      : "border border-mint-glow/40 text-mint-glow hover:bg-mint-glow/10"
                  }`}
                >
                  {loading === plan.name.toLowerCase() ? "Redirigiendo..." : plan.cta}
                </button>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
