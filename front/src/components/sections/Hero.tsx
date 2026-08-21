"use client";

import { useRef, useEffect } from "react";
import { motion, useInView } from "framer-motion";
import gsap from "gsap";

export default function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const blob1Ref = useRef<HTMLDivElement>(null);
  const blob2Ref = useRef<HTMLDivElement>(null);
  const blob3Ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true });

  useEffect(() => {
    if (!blob1Ref.current || !blob2Ref.current || !blob3Ref.current) return;

    const tl = gsap.timeline({ repeat: -1, yoyo: true });

    tl.to(blob1Ref.current, {
      borderRadius: "30% 60% 70% 40% / 50% 60% 30% 60%",
      x: 30, y: -20, duration: 12, ease: "sine.inOut",
    }, 0);

    tl.to(blob2Ref.current, {
      borderRadius: "50% 30% 60% 40% / 40% 50% 60% 30%",
      x: -20, y: 30, duration: 15, ease: "sine.inOut",
    }, 0);

    tl.to(blob3Ref.current, {
      borderRadius: "40% 60% 30% 70% / 60% 40% 70% 30%",
      x: 40, y: 20, rotation: 10, duration: 18, ease: "sine.inOut",
    }, 0);

    return () => { tl.kill(); };
  }, []);

  return (
    <section
      ref={sectionRef}
      style={{
        position: "relative",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {/* Liquid Blobs Background */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <div ref={blob1Ref} className="blob blob-1" style={{ borderRadius: "60% 40% 30% 70% / 60% 30% 70% 40%" }} />
        <div ref={blob2Ref} className="blob blob-2" style={{ borderRadius: "60% 40% 30% 70% / 60% 30% 70% 40%" }} />
        <div ref={blob3Ref} className="blob blob-3" style={{ borderRadius: "60% 40% 30% 70% / 60% 30% 70% 40%" }} />
      </div>

      {/* Content */}
      <div style={{
        position: "relative",
        zIndex: 10,
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "140px 2rem 100px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
      }}>
        {/* Mechanical Cat */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={isInView ? { scale: 1, opacity: 1 } : {}}
          transition={{ duration: 1, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.2 }}
          style={{ marginBottom: "48px" }}
        >
          <img
            src="/assets/hero_logo.svg"
            alt="AutoMisho - Tu copiloto IA"
            style={{ width: "300px", height: "auto", filter: "drop-shadow(0 0 30px rgba(151,252,215,0.15))" }}
          />
        </motion.div>

        {/* Tagline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.5 }}
          style={{ marginBottom: "24px" }}
        >
          <span className="tag">
            <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: "var(--color-mint-glow)" }} className="animate-pulse" />
            IA que entiende de coches
          </span>
        </motion.div>

        {/* Main Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.7 }}
          className="text-display text-pure-light"
          style={{ marginBottom: "32px", maxWidth: "900px" }}
        >
          Tu copiloto para
          <br />
          <span className="glow-text">comprar coches</span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.9 }}
          className="text-body text-mist-gray"
          style={{ maxWidth: "600px", marginBottom: "48px", lineHeight: 1.6 }}
        >
          AutoMisho busca en todas las plataformas, analiza historial, precios y
          fiabilidad. Tú solo dile qué necesitas.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 1.1 }}
          style={{ display: "flex", gap: "16px", marginBottom: "80px", flexWrap: "wrap", justifyContent: "center" }}
        >
          <a href="#demo" className="btn-pill btn-primary" style={{ fontSize: "16px", padding: "16px 32px" }}>
            Empezar Gratis
          </a>
          <a href="#how-it-works" className="btn-pill btn-ghost" style={{ fontSize: "16px", padding: "16px 32px" }}>
            Ver cómo funciona
          </a>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 1, delay: 1.5 }}
          style={{ display: "flex", gap: "48px", flexWrap: "wrap", justifyContent: "center" }}
        >
          {[
            { value: "260K+", label: "Coches analizados" },
            { value: "4", label: "Fuentes de datos" },
            { value: "€0", label: "Para empezar" },
          ].map((stat) => (
            <div key={stat.label} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span className="text-heading-lg text-pure-light font-teodor">
                {stat.value}
              </span>
              <span className="text-caption text-mist-gray" style={{ marginTop: "4px" }}>
                {stat.label}
              </span>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Bottom gradient fade */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "128px", background: "linear-gradient(to top, var(--color-forest-depths), transparent)", pointerEvents: "none" }} />
    </section>
  );
}
