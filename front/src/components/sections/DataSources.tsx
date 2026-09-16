"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";

const sources = [
  { name: "AutoScout24", tag: "Catálogo Europeo", icon: "🚗" },
  { name: "coches.net", tag: "Líder España", icon: "🇪🇸" },
  { name: "InfoCoche DGT", tag: "Informes Oficiales", icon: "📑" },
  { name: "Milanuncios", tag: "Particulares", icon: "⚡" },
  { name: "Wallapop", tag: "Segunda Mano", icon: "💬" },
];

export default function DataSources() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-50px" });

  return (
    <section ref={sectionRef} className="w-full max-w-5xl mx-auto px-4 py-16 text-center">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5 }}
      >
        <p className="text-xs uppercase tracking-widest text-ash font-medium mb-3">
          Cobertura de Mercado
        </p>

        <h3 className="font-ppmondwest text-2xl sm:text-3xl text-graphite font-normal mb-6">
          Escaneo simultáneo de los principales portales de compraventa
        </h3>

        <div className="flex flex-wrap justify-center gap-3 mb-6">
          {sources.map((source, index) => (
            <motion.div
              key={source.name}
              initial={{ opacity: 0, y: 12 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.35, delay: index * 0.06 }}
              className="py-2 px-4 rounded-full bg-paper border border-mist flex items-center gap-2.5 shadow-sm hover:border-signal-blue transition-colors cursor-default"
            >
              <span className="text-base">{source.icon}</span>
              <span className="text-sm font-medium text-graphite">
                {source.name}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-ash px-2 py-0.5 rounded-full bg-linen border border-mist">
                {source.tag}
              </span>
            </motion.div>
          ))}
        </div>

        <p className="text-xs sm:text-sm text-ash max-w-lg mx-auto leading-relaxed">
          AutoMisho recopila, filtra anuncios duplicados, audita fotos y compara precios en tiempo real para encontrar las mejores oportunidades para ti.
        </p>
      </motion.div>
    </section>
  );
}
