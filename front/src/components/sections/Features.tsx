"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import FeatureIcon from "../icons/FeatureIcons";

const features = [
  {
    icon: "ai-advisor",
    title: "IA Asesora con Visión",
    description:
      "Habla en lenguaje natural. AutoMisho entiende tu presupuesto, uso diario y analiza las fotos de los anuncios para detectar 3p/5p y estado exterior.",
    tag: "Core",
  },
  {
    icon: "multi-source",
    title: "Scraping Multi-Fuente",
    description:
      "Busca simultáneamente en AutoScout24, coches.net, Wallapop y Milanuncios. Una sola consulta escanea todo el mercado nacional.",
    tag: "Datos",
  },
  {
    icon: "vehicle-history",
    title: "Historial DGT y VIN",
    description:
      "Integración oficial con InfoCoche para emitir informes completos DGT en PDF y decodificador de bastidor ISO 3779.",
    tag: "Seguridad",
  },
  {
    icon: "alerts",
    title: "Detección de Alertas",
    description:
      "Detecta precios sospechosos, descripciones engañosas, anuncios duplicados y discrepancias de kilómetros antes de contactar.",
    tag: "Protección",
  },
  {
    icon: "comparison",
    title: "Comparador Inteligente",
    description:
      "Compara candidatos con una puntuación global objetiva (0-100), pros y contras técnicos, y coste estimado de averías comunes.",
    tag: "Análisis",
  },
  {
    icon: "price-analysis",
    title: "Oportunidades de Reventa",
    description:
      "Evalúa chollos y coches con desperfectos leves que puedes reparar fácilmente para reventa con beneficio estimado.",
    tag: "Inversión",
  },
];

export default function Features() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-80px" });

  return (
    <section
      ref={sectionRef}
      id="features"
      className="max-w-6xl mx-auto px-4 py-20 sm:py-28"
    >
      {/* Section Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6 }}
        className="text-center mb-16"
      >
        <p className="text-xs uppercase tracking-widest text-ash font-medium mb-3">
          Capacidades del Sistema
        </p>
        <h2 className="text-heading sm:text-heading-lg text-graphite font-normal max-w-2xl mx-auto">
          Todo lo que necesitas para comprar un coche con total certeza
        </h2>
      </motion.div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((feature, index) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: index * 0.08 }}
            className="card group flex flex-col justify-between p-7 hover:-translate-y-1 transition-all"
          >
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="w-12 h-12 rounded-xl bg-linen border border-mist flex items-center justify-center text-signal-blue group-hover:text-cerulean transition-colors">
                  <FeatureIcon name={feature.icon} size={28} />
                </div>
                <span className="tag text-[11px] text-ash">
                  {feature.tag}
                </span>
              </div>

              <h3 className="font-ppmondwest text-xl text-graphite font-normal mb-2.5">
                {feature.title}
              </h3>

              <p className="text-charcoal text-sm leading-relaxed font-normal">
                {feature.description}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
