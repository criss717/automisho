"use client";

import { useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import Link from "next/link";

const plans = [
  {
    name: "Gratis",
    price: "€0",
    period: "siempre",
    description: "Para explorar el copiloto y búsquedas habituales",
    features: [
      "5 búsquedas inteligentes al día",
      "Copilot Workspace con Live Dashboard",
      "Decodificador oficial de matrículas y bastidores VIN",
      "Auditoría gratuita de PDFs DGT/ITV subidos al chat",
    ],
    cta: "Empezar Gratis",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "€25",
    period: "/mes",
    description: "Para compradores en búsqueda activa y negociación",
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
    description: "Máxima cobertura con auditoría profunda y reventa",
    features: [
      "Búsquedas ilimitadas + Modo Profundo (100 coches)",
      "2 Informes Completos DGT Oficiales (PDF) incluidos",
      "Auditoría profunda de siniestros, ITVs y cargas",
      "Detección de chollos y oportunidad de reventa/flip",
      "Envío directo de informes oficiales a tu email",
      "Informes DGT adicionales a 15,99€",
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
      className="max-w-6xl mx-auto px-4 py-20 sm:py-28"
    >
      {/* Section Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6 }}
        className="text-center mb-16 space-y-3"
      >
        <p className="text-xs uppercase tracking-widest text-ash font-medium">
          Planes y Tarifas
        </p>
        <h2 className="text-heading sm:text-heading-lg text-graphite font-normal max-w-xl mx-auto">
          Elige el nivel de acompañamiento para tu compra
        </h2>
        <p className="text-sm text-ash max-w-md mx-auto">
          Comienza gratis o accede a informes oficiales de la DGT y escaneo masivo sin límites.
        </p>
      </motion.div>

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
        {plans.map((plan, index) => (
          <motion.div
            key={plan.name}
            initial={{ opacity: 0, y: 24 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            className="flex flex-col"
          >
            <div
              className={`card h-full flex flex-col justify-between p-8 rounded-2xl relative transition-all ${
                plan.highlighted
                  ? "border-signal-blue shadow-md ring-1 ring-signal-blue/20"
                  : "border-mist hover:border-fog shadow-subtle"
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-0.5 rounded-full text-[11px] font-medium uppercase tracking-wider bg-linen text-signal-blue border border-signal-blue">
                    Recomendado
                  </span>
                </div>
              )}

              {/* Plan Header */}
              <div className="mb-6 pt-1">
                <h3 className="font-ppmondwest text-2xl text-graphite font-normal mb-1">
                  {plan.name}
                </h3>
                <p className="text-xs text-ash mb-4 min-h-[32px] leading-relaxed">
                  {plan.description}
                </p>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-ppmondwest text-4xl sm:text-5xl text-graphite font-normal">
                    {plan.price}
                  </span>
                  <span className="text-xs text-ash font-medium">
                    {plan.period}
                  </span>
                </div>
              </div>

              {/* Features List */}
              <ul className="flex-1 space-y-3 mb-8 border-t border-mist pt-6">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2.5 text-xs sm:text-sm text-charcoal leading-relaxed"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      className="mt-0.5 shrink-0 text-signal-blue"
                    >
                      <path
                        d="M3.5 8 L6.5 11 L12.5 4"
                        stroke="currentColor"
                        strokeWidth="1.8"
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
                  className="btn-secondary w-full py-3 text-center justify-center text-sm font-medium"
                >
                  {plan.cta}
                </Link>
              ) : (
                <button
                  onClick={() => handleCheckout(plan.name.toLowerCase())}
                  disabled={loading === plan.name.toLowerCase()}
                  className={`w-full py-3 text-center justify-center text-sm font-medium ${
                    plan.highlighted ? "btn-primary" : "btn-secondary"
                  }`}
                >
                  {loading === plan.name.toLowerCase() ? "Conectando con pasarela..." : plan.cta}
                </button>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
