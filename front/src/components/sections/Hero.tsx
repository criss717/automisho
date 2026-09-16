"use client";

import { useRef, useEffect } from "react";
import { motion, useInView } from "framer-motion";
import gsap from "gsap";
import AutoMishoCat from "../icons/AutoMishoCat";

export default function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const blob1Ref = useRef<HTMLDivElement>(null);
  const blob2Ref = useRef<HTMLDivElement>(null);
  const blob3Ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true });

  useEffect(() => {
    if (!blob1Ref.current || !blob2Ref.current || !blob3Ref.current) return;

    const tl = gsap.timeline({ repeat: -1, yoyo: true });

    tl.to(
      blob1Ref.current,
      {
        borderRadius: "30% 60% 70% 40% / 50% 60% 30% 60%",
        x: 25,
        y: -15,
        duration: 14,
        ease: "sine.inOut",
      },
      0
    );

    tl.to(
      blob2Ref.current,
      {
        borderRadius: "50% 30% 60% 40% / 40% 50% 60% 30%",
        x: -20,
        y: 20,
        duration: 16,
        ease: "sine.inOut",
      },
      0
    );

    tl.to(
      blob3Ref.current,
      {
        borderRadius: "40% 60% 30% 70% / 60% 40% 70% 30%",
        x: 30,
        y: 15,
        duration: 18,
        ease: "sine.inOut",
      },
      0
    );

    return () => {
      tl.kill();
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative min-h-[92vh] flex items-center justify-center overflow-hidden bg-parchment pt-28 pb-16 px-4"
    >
      {/* Subtle Atmospheric Wash */}
      <div className="absolute inset-0 pointer-events-none">
        <div ref={blob1Ref} className="blob blob-1" />
        <div ref={blob2Ref} className="blob blob-2" />
        <div ref={blob3Ref} className="blob blob-3" />
      </div>

      {/* Main Content */}
      <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center text-center">
        {/* Interactive Mechanical Cat Mascot with Cursor Eye Tracking */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={isInView ? { scale: 1, opacity: 1 } : {}}
          transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.1 }}
          className="mb-8 relative"
        >
          <AutoMishoCat size={270} className="mx-auto" />
          <div className="mt-2 text-[11px] text-ash tracking-wide uppercase font-medium flex items-center justify-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-signal-blue animate-pulse" />
            <span>Mishi interactivo — mueve tu ratón para seguir la mirada</span>
          </div>
        </motion.div>

        {/* Editorial Pill Eyebrow */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mb-5"
        >
          <span className="tag px-3.5 py-1 text-xs text-charcoal border-mist bg-paper/80 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-signal-blue" />
            Copiloto experto en coches de segunda mano
          </span>
        </motion.div>

        {/* Headline — Display Serif ppmondwest, weight 400, tight tracking */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.45 }}
          className="text-display sm:text-[54px] text-graphite mb-6 max-w-3xl leading-[1.1] tracking-[-0.03em] font-normal"
        >
          Tu copiloto de inteligencia artificial para{" "}
          <span className="italic font-normal underline decoration-mist underline-offset-8">
            comprar coches
          </span>
        </motion.h1>

        {/* Subheadline — af Clean Sans */}
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="text-body text-charcoal max-w-xl mb-10 leading-relaxed font-normal"
        >
          AutoMisho escanea los portales líderes en España, audita visualmente las fotos
          con visión multimodal y revisa precios e historial DGT. Tú solo dile qué buscas.
        </motion.p>

        {/* Outlined Action Buttons (DESIGN.md: 8px radius, no box shadow) */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.75 }}
          className="flex flex-wrap items-center justify-center gap-4 mb-16"
        >
          <a
            href="#demo"
            className="btn-primary py-3 px-6 text-[15px] font-medium flex items-center gap-2"
          >
            <span>Empezar Gratis</span>
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-signal-blue text-xs">
              →
            </span>
          </a>
          <a
            href="#how-it-works"
            className="btn-secondary py-3 px-6 text-[15px] font-medium"
          >
            Ver cómo funciona
          </a>
        </motion.div>

        {/* Paper Stats Bar with Hairline Borders */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.9 }}
          className="w-full max-w-2xl bg-paper/90 border border-mist rounded-2xl py-5 px-6 shadow-sm flex flex-wrap items-center justify-around gap-4"
        >
          {[
            { value: "260K+", label: "Coches analizados" },
            { value: "5 Fuentes", label: "AutoScout, coches.net, Wallapop..." },
            { value: "Visión IA", label: "Auditoría de fotos y chapa" },
            { value: "€0", label: "Para comenzar" },
          ].map((stat, i) => (
            <div key={stat.label} className="flex flex-col items-center">
              <span className="font-ppmondwest text-2xl text-graphite font-normal">
                {stat.value}
              </span>
              <span className="text-xs text-ash mt-0.5 font-normal">
                {stat.label}
              </span>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Subtle Hairline Section Divider */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-mist" />
    </section>
  );
}
