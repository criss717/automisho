"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";

const steps = [
  {
    number: "01",
    title: "Dile qué buscas",
    description:
      'Habla con AutoMisho como con un asesor de confianza. "Quiero un compacto gasolina de menos de 3.000€ con 3 puertas en Madrid".',
    icon: (
      <svg width="40" height="40" viewBox="0 0 48 48" fill="none" className="text-signal-blue">
        <rect x="8" y="8" width="32" height="28" rx="8" stroke="currentColor" strokeWidth="2" />
        <path d="M16 36 L12 44 L24 36" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <line x1="16" y1="18" x2="32" y2="18" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
        <line x1="16" y1="24" x2="28" y2="24" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
      </svg>
    ),
  },
  {
    number: "02",
    title: "Escaneo y Visión IA",
    description:
      "Rastrea AutoScout24, coches.net, Wallapop y Milanuncios. Inspecciona fotos con visión artificial para certificar puertas, chapa y faros.",
    icon: (
      <svg width="40" height="40" viewBox="0 0 48 48" fill="none" className="text-signal-blue">
        <circle cx="20" cy="20" r="12" stroke="currentColor" strokeWidth="2" />
        <line x1="28" y1="28" x2="38" y2="38" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="20" cy="20" r="4" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
      </svg>
    ),
  },
  {
    number: "03",
    title: "Informe y Negociación",
    description:
      "Recibe recomendaciones con nota IA (0-100), precio justo, auditoría DGT opcional y argumentos listos para negociar con el vendedor.",
    icon: (
      <svg width="40" height="40" viewBox="0 0 48 48" fill="none" className="text-signal-blue">
        <rect x="10" y="6" width="28" height="36" rx="4" stroke="currentColor" strokeWidth="2" />
        <path d="M18 22 L22 26 L30 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="16" y1="32" x2="32" y2="32" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
        <line x1="16" y1="36" x2="28" y2="36" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
      </svg>
    ),
  },
];

export default function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-50px" });

  return (
    <section ref={sectionRef} id="how-it-works" className="max-w-6xl mx-auto px-4 py-20 sm:py-28">
      {/* Section Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6 }}
        className="text-center mb-16"
      >
        <p className="text-xs uppercase tracking-widest text-ash font-medium mb-3">
          Metodología
        </p>
        <h2 className="text-heading sm:text-heading-lg text-graphite font-normal max-w-2xl mx-auto">
          Tres pasos para comprar tu coche sin sorpresas
        </h2>
      </motion.div>

      {/* Steps Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
        {steps.map((step, index) => (
          <motion.div
            key={step.number}
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: index * 0.15 }}
          >
            <div className="card h-full flex flex-col p-8 relative hover:-translate-y-1 transition-transform">
              <div className="flex items-center justify-between mb-6">
                <span className="font-ppmondwest text-3xl text-twilight font-normal">
                  {step.number}
                </span>
                <div className="w-12 h-12 rounded-xl bg-linen border border-mist flex items-center justify-center">
                  {step.icon}
                </div>
              </div>

              <h3 className="font-ppmondwest text-2xl text-graphite font-normal mb-3">
                {step.title}
              </h3>

              <p className="text-charcoal text-sm leading-relaxed font-normal">
                {step.description}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
