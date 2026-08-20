"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import FeatureIcon from "../icons/FeatureIcons";

const features = [
  {
    icon: "ai-advisor",
    title: "IA Asesora",
    description:
      "Habla en lenguaje natural. AutoMisho entiende tu presupuesto, uso preferido y te da recomendaciones personalizadas.",
    tag: "Core",
  },
  {
    icon: "multi-source",
    title: "Scraping Multi-Fuente",
    description:
      "Busca simultáneamente en AutoScout24, coches.net y más. Una sola búsqueda, todas las opciones.",
    tag: "Datos",
  },
  {
    icon: "vehicle-history",
    title: "Historial Verificado",
    description:
      "Integración con carVertical para verificar robos, accidentes, kilómetros y propietarios anteriores.",
    tag: "Seguridad",
  },
  {
    icon: "alerts",
    title: "Alertas Rojas",
    description:
      "Detecta precios sospechosos, km inconsistentes, vendedores con múltiples listings y descripciones engañosas.",
    tag: "Protección",
  },
  {
    icon: "comparison",
    title: "Comparación Inteligente",
    description:
      "Compara coches lado a lado con análisis de precio justo, fiabilidad del modelo y coste total de propiedad.",
    tag: "Análisis",
  },
  {
    icon: "price-analysis",
    title: "Análisis de Mercado",
    description:
      "¿Es buen precio? AutoMisho compara con el mercado actual y te dice si es una ganga o está sobrevalorado.",
    tag: "Valor",
  },
];

export default function Features() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });

  return (
    <section
      ref={sectionRef}
      id="features"
      className="section relative"
    >
      {/* Background accent */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-shadow-teal/20 rounded-full blur-[120px]" />
      </div>

      {/* Section Header */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.8 }}
        className="section-header relative z-10"
      >
        <p className="section-eyebrow">Funciones</p>
        <h2 className="section-title">
          Todo lo que necesitas para comprar con confianza
        </h2>
      </motion.div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
        {features.map((feature, index) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            className="card group relative overflow-hidden"
          >
            {/* Hover glow effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-mint-glow/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="relative z-10">
              {/* Tag */}
              <span className="tag text-caption mb-4 inline-flex">
                {feature.tag}
              </span>

              {/* Icon */}
              <div className="w-12 h-12 text-mint-glow mb-4">
                <FeatureIcon name={feature.icon} size={48} />
              </div>

              {/* Title */}
              <h3 className="text-subheading text-pure-light font-teodor mb-2">
                {feature.title}
              </h3>

              {/* Description */}
              <p className="text-body-sm text-mist-gray leading-relaxed">
                {feature.description}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
