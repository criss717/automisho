"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";

const sources = [
  { name: "AutoScout24" },
  { name: "coches.net" },
  { name: "carVertical" },
  { name: "Milanuncios" },
];

export default function DataSources() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-50px" });

  return (
    <section ref={sectionRef} style={{ maxWidth: "1200px", margin: "0 auto", padding: "48px 2rem", textAlign: "center" }}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : {}}
        transition={{ duration: 0.6 }}
      >
        <p style={{ color: "#97fcd7", fontSize: "14px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "24px" }}>
          Fuentes de datos
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "12px", marginBottom: "24px" }}>
          {sources.map((source, index) => (
            <motion.div
              key={source.name}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="float"
              style={{ animationDelay: `${index * -2}s` }}
            >
              <div style={{
                padding: "10px 20px",
                borderRadius: "60px",
                border: "1px solid #0f3933",
                background: "rgba(35,82,76,0.3)",
              }}>
                <span style={{ color: "#b0c5c1", fontSize: "16px" }}>{source.name}</span>
              </div>
            </motion.div>
          ))}
        </div>

        <p style={{ color: "#b0c5c1", fontSize: "14px", maxWidth: "500px", margin: "0 auto" }}>
          Y muchas más fuentes en camino. Siempre buscando las mejores oportunidades para ti.
        </p>
      </motion.div>
    </section>
  );
}
