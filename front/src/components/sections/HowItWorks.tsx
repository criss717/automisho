"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";

const steps = [
  {
    number: "01",
    title: "Dile qué buscas",
    description:
      'Habla con AutoMisho como lo harías con un amigo. "Quiero un SUV familiar de menos de 15.000€ en Madrid"',
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <rect x="8" y="8" width="32" height="28" rx="8" stroke="currentColor" strokeWidth="2" />
        <path d="M16 36 L12 44 L24 36" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <line x1="16" y1="18" x2="32" y2="18" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
        <line x1="16" y1="24" x2="28" y2="24" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
      </svg>
    ),
  },
  {
    number: "02",
    title: "AutoMisho busca",
    description:
      "Scrapea AutoScout24, coches.net y más. Cruza datos con historial de vehículos y análisis de fiabilidad.",
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <circle cx="20" cy="20" r="12" stroke="currentColor" strokeWidth="2" />
        <line x1="28" y1="28" x2="38" y2="38" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="20" cy="20" r="4" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
      </svg>
    ),
  },
  {
    number: "03",
    title: "Recibe tu informe",
    description:
      "Análisis completo: precio justo, alertas rojas, comparación con similares, y recomendación personalizada.",
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <rect x="10" y="6" width="28" height="36" rx="4" stroke="currentColor" strokeWidth="2" />
        <path d="M18 22 L22 26 L30 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="16" y1="32" x2="32" y2="32" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
        <line x1="16" y1="36" x2="28" y2="36" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
      </svg>
    ),
  },
];

export default function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-50px" });

  return (
    <section ref={sectionRef} id="how-it-works" style={{ maxWidth: "1200px", margin: "0 auto", padding: "5rem 2rem" }}>
      {/* Section Header */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6 }}
        style={{ textAlign: "center", marginBottom: "48px" }}
      >
        <p style={{ color: "var(--color-mint-glow)", fontSize: "14px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "12px" }}>
          Cómo funciona
        </p>
        <h2 style={{ color: "var(--color-pure-light)", fontSize: "48px", fontFamily: "Georgia, serif", fontWeight: 400, lineHeight: 1, maxWidth: "600px", margin: "0 auto" }}>
          Tres pasos hacia tu próximo coche
        </h2>
      </motion.div>

      {/* Steps */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "24px", position: "relative" }}>
        {/* Connecting line */}
        <div style={{ position: "absolute", top: "80px", left: "18%", right: "18%", height: "1px", background: "linear-gradient(to right, transparent, var(--color-teal-pulse), transparent)", opacity: 0.3 }} />

        {steps.map((step, index) => (
          <motion.div
            key={step.number}
            initial={{ opacity: 0, y: 40 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: index * 0.15 }}
          >
            <div style={{
              background: "var(--color-shadow-teal)",
              border: "1px solid var(--color-midnight-tide)",
              borderRadius: "12px",
              padding: "32px 24px",
              textAlign: "center",
              height: "100%",
              position: "relative",
            }}>
              {/* Step Number */}
              <div style={{ position: "absolute", top: "-14px", left: "50%", transform: "translateX(-50%)" }}>
                <span style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: "var(--color-mint-glow)",
                  color: "var(--color-forest-depths)",
                  fontSize: "12px",
                  fontWeight: 600,
                }}>
                  {step.number}
                </span>
              </div>

              {/* Icon */}
              <div style={{ width: "56px", height: "56px", margin: "24px auto 20px", color: "var(--color-mint-glow)" }}>
                {step.icon}
              </div>

              {/* Title */}
              <h3 style={{ color: "var(--color-pure-light)", fontSize: "24px", fontFamily: "Georgia, serif", fontWeight: 400, marginBottom: "12px" }}>
                {step.title}
              </h3>

              {/* Description */}
              <p style={{ color: "var(--color-mist-gray)", fontSize: "16px", lineHeight: 1.6 }}>
                {step.description}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
