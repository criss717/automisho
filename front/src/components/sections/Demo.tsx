"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import NutSpinner from "../icons/NutSpinner";
import AutoMishoCat from "../icons/AutoMishoCat";

const chatMessages = [
  {
    role: "user" as const,
    text: "Estoy buscando un coche compacto de 3 puertas fiable por menos de 3.000€ en Madrid.",
  },
  {
    role: "assistant" as const,
    text: "Perfecto. Escaneando AutoScout24, coches.net, Wallapop y Milanuncios con visión artificial para certificar 3 puertas y estado de chapa...",
    loading: true,
  },
  {
    role: "assistant" as const,
    text: "He seleccionado 3 unidades sobresalientes que cumplen rigurosamente tus filtros:",
  },
  {
    role: "assistant" as const,
    card: {
      title: "FIAT Punto 1.3 Multijet Classic (3p)",
      price: "2.999 €",
      year: "2008",
      km: "235.000 km",
      location: "Madrid",
      score: 88,
      alerts: 0,
      source: "coches.net",
    },
  },
  {
    role: "assistant" as const,
    text: "Esta unidad es mi opción recomendada: carrocería 3 puertas verificada por foto, motor diésel de consumo bajísimo y sin incidencias DGT reportadas.",
  },
];

export default function Demo() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-50px" });
  const [visibleMessages, setVisibleMessages] = useState(0);

  useEffect(() => {
    if (!isInView) return;

    const timer = setInterval(() => {
      setVisibleMessages((prev) => {
        if (prev >= chatMessages.length) {
          clearInterval(timer);
          return prev;
        }
        return prev + 1;
      });
    }, 700);

    return () => clearInterval(timer);
  }, [isInView]);

  return (
    <section ref={sectionRef} id="demo" className="max-w-4xl mx-auto px-4 py-20 sm:py-28 text-center">
      {/* Section Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6 }}
        className="mb-14"
      >
        <p className="text-xs uppercase tracking-widest text-ash font-medium mb-3">
          Demostración en Vivo
        </p>
        <h2 className="text-heading sm:text-heading-lg text-graphite font-normal max-w-xl mx-auto">
          Conversaciones precisas, criterio técnico real
        </h2>
      </motion.div>

      {/* Chat Container Card (Paper with 1px Mist border) */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="max-w-2xl mx-auto"
      >
        <div className="card text-left p-6 sm:p-8 bg-paper border border-mist shadow-subtle rounded-2xl">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 mb-6 border-b border-mist">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-linen border border-mist flex items-center justify-center overflow-hidden">
                <AutoMishoCat size={24} interactive={false} />
              </div>
              <div>
                <p className="text-sm font-medium text-graphite">AutoMisho Copilot</p>
                <p className="text-xs text-ash flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-signal-blue animate-pulse" />
                  Asistente activo con visión IA
                </p>
              </div>
            </div>
            <span className="tag text-[11px] text-charcoal">Demo interactiva</span>
          </div>

          {/* Message Thread */}
          <div className="min-h-[460px] flex flex-col gap-4 overflow-hidden">
            <AnimatePresence>
              {chatMessages.slice(0, visibleMessages).map((msg, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.card ? (
                    <div className="w-full max-w-sm p-4 rounded-xl bg-linen border border-mist shadow-sm">
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <h4 className="text-sm font-medium text-graphite">{msg.card.title}</h4>
                        <span className="text-[10px] px-2 py-0.5 rounded-full border border-signal-blue text-signal-blue font-medium shrink-0">
                          {msg.card.source}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-3 mb-3">
                        <span className="font-ppmondwest text-2xl text-graphite font-normal">
                          {msg.card.price}
                        </span>
                        <span className="text-xs text-ash">
                          {msg.card.year} · {msg.card.km} · {msg.card.location}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-mist rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${msg.card.score}%` }}
                            transition={{ duration: 0.8, delay: 0.2 }}
                            className="h-full bg-signal-blue rounded-full"
                          />
                        </div>
                        <span className="text-xs text-graphite font-medium">
                          {msg.card.score}/100
                        </span>
                      </div>
                      <p className="text-xs text-ash mt-2 flex items-center gap-1.5">
                        <span className="text-signal-blue font-bold">✓</span>
                        Carrocería 3p verificada en fotos y sin alertas
                      </p>
                    </div>
                  ) : (
                    <div
                      className={`max-w-[85%] text-sm px-4 py-3 leading-relaxed ${
                        msg.role === "user"
                          ? "bg-linen border border-mist text-graphite font-medium rounded-2xl rounded-br-sm"
                          : "bg-paper border border-mist text-charcoal rounded-2xl rounded-bl-sm shadow-sm"
                      }`}
                    >
                      {msg.loading && visibleMessages === index + 1 ? (
                        <div className="flex items-center gap-2 text-ash">
                          <NutSpinner size={16} />
                          <span>{msg.text}</span>
                        </div>
                      ) : (
                        msg.text
                      )}
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Typing indicator */}
            {visibleMessages < chatMessages.length && isInView && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-1.5 p-2 text-ash"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-fog animate-bounce" />
                <span className="w-1.5 h-1.5 rounded-full bg-fog animate-bounce [animation-delay:0.15s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-fog animate-bounce [animation-delay:0.3s]" />
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>
    </section>
  );
}
