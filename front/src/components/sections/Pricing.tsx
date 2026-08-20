"use client";

import { useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import Link from "next/link";

const plans = [
  {
    name: "Gratis",
    price: "€0",
    period: "siempre",
    description: "Para explorar y probar AutoMisho",
    features: [
      "5 búsquedas al día",
      "Resultados básicos",
      "1 fuente de datos",
      "Sin historial de vehículos",
    ],
    cta: "Empezar Gratis",
    highlighted: false,
  },
  {
    name: "Premium",
    price: "€4.99",
    period: "/mes",
    description: "Para compradores serios",
    features: [
      "Búsquedas ilimitadas",
      "Todas las fuentes de datos",
      "2 informes carVertical/mes",
      "Alertas de nuevos listings",
      "Comparación avanzada",
      "Soporte prioritario",
    ],
    cta: "Suscribirse",
    highlighted: true,
  },
  {
    name: "Pro",
    price: "€9.99",
    period: "/mes",
    description: "Para profesionales y concesionarios",
    features: [
      "Todo de Premium",
      "Informes ilimitados",
      "Análisis predictivo de mercado",
      "API de acceso",
      "Exportación de informes PDF",
      "Acceso anticipado a funciones",
    ],
    cta: "Contactar",
    highlighted: false,
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
      className="section relative"
    >
      {/* Background accent */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 right-0 w-[400px] h-[400px] bg-shadow-teal/15 rounded-full blur-[100px]" />
      </div>

      {/* Section Header */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.8 }}
        className="section-header section-title--center relative z-10"
      >
        <p className="section-eyebrow text-center">Precios</p>
        <h2 className="section-title text-center mx-auto">
          Elige tu plan
        </h2>
      </motion.div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
        {plans.map((plan, index) => (
          <motion.div
            key={plan.name}
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: index * 0.15 }}
            className={`relative ${
              plan.highlighted ? "md:-mt-4 md:mb-[-16px]" : ""
            }`}
          >
            <div
              className={`h-full flex flex-col ${
                plan.highlighted
                  ? "card-glow border-mint-glow/40"
                  : "card"
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="tag bg-mint-glow text-forest-depths border-mint-glow font-inter font-normal">
                    Popular
                  </span>
                </div>
              )}

              {/* Plan Header */}
              <div className="mb-6">
                <h3 className="text-subheading text-pure-light font-teodor mb-2">
                  {plan.name}
                </h3>
                <p className="text-caption text-mist-gray mb-4">
                  {plan.description}
                </p>
                <div className="flex items-baseline gap-1">
                  <span className="text-display text-pure-light font-teodor">
                    {plan.price}
                  </span>
                  <span className="text-body-sm text-mist-gray">
                    {plan.period}
                  </span>
                </div>
              </div>

              {/* Features */}
              <ul className="flex-1 space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2 text-body-sm text-mist-gray"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      className="mt-0.5 flex-shrink-0"
                    >
                      <path
                        d="M4 8 L7 11 L12 5"
                        stroke="#97fcd7"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              {plan.name === "Gratis" ? (
                <Link
                  href="/register"
                  className={`btn-pill text-center ${
                    plan.highlighted ? "btn-primary" : "btn-ghost"
                  }`}
                >
                  {plan.cta}
                </Link>
              ) : (
                <button
                  onClick={() => handleCheckout(plan.name.toLowerCase())}
                  disabled={loading === plan.name.toLowerCase()}
                  className={`btn-pill text-center w-full ${
                    plan.highlighted ? "btn-primary" : "btn-ghost"
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
