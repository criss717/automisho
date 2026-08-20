"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import NutSpinner from "../icons/NutSpinner";

const chatMessages = [
  {
    role: "user" as const,
    text: "Estoy buscando un SUV familiar de menos de 15.000€. Vivo en Madrid y hago unos 20.000km al año.",
  },
  {
    role: "assistant" as const,
    text: "Perfecto, déjame buscar las mejores opciones para ti. Analizando AutoScout24, coches.net y verificando historiales...",
    loading: true,
  },
  {
    role: "assistant" as const,
    text: "He encontrado 3 opciones excelentes para ti:",
  },
  {
    role: "assistant" as const,
    card: {
      title: "Nissan Qashqai 1.5 dCi Tekna",
      price: "€13.900",
      year: "2019",
      km: "87.000 km",
      location: "Madrid",
      score: 92,
      alerts: 0,
      source: "AutoScout24",
    },
  },
  {
    role: "assistant" as const,
    text: "Este Qashqai es mi recomendación #1. El motor 1.5 dCi es uno de los más fiables del mercado, y el acabado Tekna incluye cámara 360° y asientos calefactables. El precio está 800€ por debajo del mercado.",
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
    <section ref={sectionRef} id="demo" style={{ maxWidth: "1200px", margin: "0 auto", padding: "5rem 2rem", textAlign: "center" }}>
      {/* Section Header */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6 }}
        style={{ marginBottom: "48px" }}
      >
        <p style={{ color: "#97fcd7", fontSize: "14px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "12px" }}>
          Demo
        </p>
        <h2 style={{ color: "#ffffff", fontSize: "48px", fontFamily: "Georgia, serif", fontWeight: 400, lineHeight: 1, maxWidth: "600px", margin: "0 auto" }}>
          Así habla AutoMisho
        </h2>
      </motion.div>

      {/* Chat Container */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, delay: 0.2 }}
        style={{ maxWidth: "700px", margin: "0 auto" }}
      >
        <div style={{ background: "#23524c", border: "1px solid #0f3933", borderRadius: "12px", padding: "24px", boxShadow: "0 0 20px 5px rgba(151,252,215,0.4)" }}>
          {/* Chat Header */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px", paddingBottom: "16px", borderBottom: "1px solid #0f3933" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "#23524c", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="8" r="4" stroke="#97fcd7" strokeWidth="1.5" />
                <path d="M4 20 C4 16 8 14 12 14 C16 14 20 16 20 20" stroke="#97fcd7" strokeWidth="1.5" fill="none" />
              </svg>
            </div>
            <div>
              <p style={{ color: "#ffffff", fontSize: "14px", fontWeight: 500 }}>AutoMisho</p>
              <p style={{ color: "#97fcd7", fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#97fcd7" }} className="animate-pulse" />
                En línea
              </p>
            </div>
          </div>

          {/* Messages */}
          <div style={{ minHeight: "300px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <AnimatePresence>
              {chatMessages.slice(0, visibleMessages).map((msg, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}
                >
                  {msg.card ? (
                    <div style={{ background: "#23524c", border: "1px solid #0f3933", borderRadius: "12px", padding: "16px", maxWidth: "320px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                        <h4 style={{ color: "#ffffff", fontSize: "14px", fontWeight: 500 }}>{msg.card.title}</h4>
                        <span style={{ color: "#97fcd7", fontSize: "10px", border: "1px solid #97fcd7", borderRadius: "60px", padding: "2px 8px" }}>{msg.card.source}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "12px" }}>
                        <span style={{ color: "#97fcd7", fontSize: "28px", fontFamily: "Georgia, serif" }}>{msg.card.price}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#b0c5c1", fontSize: "12px" }}>
                          <span>{msg.card.year}</span><span>·</span><span>{msg.card.km}</span><span>·</span><span>{msg.card.location}</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{ flex: 1, height: "8px", background: "#0f3933", borderRadius: "4px", overflow: "hidden" }}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${msg.card.score}%` }}
                            transition={{ duration: 0.8, delay: 0.3 }}
                            style={{ height: "100%", background: "linear-gradient(to right, #33998c, #97fcd7)", borderRadius: "4px" }}
                          />
                        </div>
                        <span style={{ color: "#97fcd7", fontSize: "12px" }}>{msg.card.score}/100</span>
                      </div>
                      {msg.card.alerts === 0 && (
                        <p style={{ color: "#97fcd7", fontSize: "12px", marginTop: "8px", display: "flex", alignItems: "center", gap: "4px" }}>
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M3 6 L5 8 L9 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          Sin alertas rojas detectadas
                        </p>
                      )}
                    </div>
                  ) : (
                    <div style={{
                      maxWidth: "80%",
                      padding: "12px 16px",
                      borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                      background: msg.role === "user" ? "#97fcd7" : "#23524c",
                      color: msg.role === "user" ? "#072724" : "#b0c5c1",
                      fontSize: "16px",
                      lineHeight: 1.5,
                    }}>
                      {msg.loading && visibleMessages === index + 1 ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <NutSpinner size={20} />
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
                style={{ display: "flex", gap: "4px", padding: "12px 16px" }}
              >
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "rgba(151,252,215,0.5)" }} className="animate-bounce" />
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "rgba(151,252,215,0.5)" }} className="animate-bounce" />
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "rgba(151,252,215,0.5)" }} className="animate-bounce" />
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>
    </section>
  );
}
