"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";

const sources = [
  { name: "AutoScout24", tag: "Catálogo Europeo", icon: "🚗" },
  { name: "coches.net", tag: "Líder España", icon: "🇪🇸" },
  { name: "carVertical", tag: "Historial VIN", icon: "🔍" },
  { name: "Milanuncios", tag: "Particulares", icon: "⚡" },
  { name: "Wallapop", tag: "Segunda Mano", icon: "💬" },
];

export default function DataSources() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-50px" });

  return (
    <section ref={sectionRef} className="w-full max-w-6xl mx-auto px-6 py-16 text-center">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5 }}
      >
        <p className="text-xs uppercase tracking-widest text-mint-glow font-medium mb-3">
          Fuentes de datos conectadas
        </p>

        <h3 className="text-2xl sm:text-3xl text-pure-light font-teodor mb-6">
          Escaneo simultáneo de los principales portales de España
        </h3>

        <div className="flex flex-wrap justify-center gap-3 mb-6">
          {sources.map((source, index) => (
            <motion.div
              key={source.name}
              initial={{ opacity: 0, y: 14 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.35, delay: index * 0.08 }}
              className="glass-card py-2.5 px-5 rounded-full border border-midnight-tide hover:border-mint-glow/40 hover:bg-white/5 transition-all flex items-center gap-2.5 group cursor-default shadow-sm"
            >
              <span className="text-base">{source.icon}</span>
              <span className="text-sm font-medium text-pure-light group-hover:text-mint-glow transition-colors">
                {source.name}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-mist-gray/60 px-2 py-0.5 rounded-full bg-forest-depths/80 border border-white/5">
                {source.tag}
              </span>
            </motion.div>
          ))}
        </div>

        <p className="text-xs sm:text-sm text-mist-gray/70 max-w-lg mx-auto leading-relaxed">
          AutoMisho recopila, filtra anuncios duplicados y compara precios en tiempo real para encontrar las mejores oportunidades para ti.
        </p>
      </motion.div>
    </section>
  );
}
