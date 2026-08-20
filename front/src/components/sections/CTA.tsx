"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";

export default function CTA() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-50px" });

  return (
    <section ref={sectionRef} id="cta" style={{ maxWidth: "1200px", margin: "0 auto", padding: "5rem 2rem", textAlign: "center" }}>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6 }}
        style={{ maxWidth: "700px", margin: "0 auto" }}
      >
        {/* Big Cat */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={isInView ? { scale: 1, opacity: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.2 }}
          style={{ marginBottom: "40px", display: "flex", justifyContent: "center" }}
        >
          <img
            src="/assets/hero_logo.svg"
            alt="AutoMisho"
            style={{ width: "160px", height: "auto" }}
          />
        </motion.div>

        {/* Headline */}
        <h2 style={{ color: "#ffffff", fontSize: "48px", fontFamily: "Georgia, serif", fontWeight: 400, lineHeight: 1.1, marginBottom: "24px" }}>
          ¿Listo para encontrar<br />
          <span className="glow-text">tu próximo coche?</span>
        </h2>

        {/* Description */}
        <p style={{ color: "#b0c5c1", fontSize: "18px", lineHeight: 1.6, maxWidth: "500px", margin: "0 auto 40px" }}>
          Únete a miles de compradores que ya usan AutoMisho para tomar decisiones más inteligentes.
        </p>

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.4 }}
          style={{ marginBottom: "40px" }}
        >
          <a
            href="/auth/register"
            className="btn-pill btn-primary glow-pulse"
            style={{ fontSize: "18px", padding: "18px 40px", display: "inline-block" }}
          >
            Empezar ahora — es gratis
          </a>
        </motion.div>

        {/* Trust badges */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.6 }}
          style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "24px", color: "#b0c5c1", fontSize: "14px" }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M4 7 L6 9 L10 5" stroke="#97fcd7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Sin tarjeta de crédito
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M4 7 L6 9 L10 5" stroke="#97fcd7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Cancela cuando quieras
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M4 7 L6 9 L10 5" stroke="#97fcd7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Soporte en español
          </span>
        </motion.div>
      </motion.div>
    </section>
  );
}
