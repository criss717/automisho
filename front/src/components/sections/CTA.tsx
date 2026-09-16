"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import Link from "next/link";
import AutoMishoCat from "../icons/AutoMishoCat";

export default function CTA() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-50px" });

  return (
    <section ref={sectionRef} id="cta" className="max-w-4xl mx-auto px-4 py-20 sm:py-28 text-center">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6 }}
        className="card p-10 sm:p-14 rounded-3xl bg-paper border border-mist shadow-subtle flex flex-col items-center"
      >
        {/* Cat Avatar */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={isInView ? { scale: 1, opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="w-20 h-20 rounded-2xl bg-linen border border-mist flex items-center justify-center mb-6 shadow-sm overflow-hidden"
        >
          <AutoMishoCat size={64} interactive={false} />
        </motion.div>

        {/* Headline */}
        <h2 className="font-ppmondwest text-heading sm:text-heading-lg text-graphite font-normal mb-4 max-w-lg leading-tight">
          ¿Listo para encontrar tu próximo coche con criterio experto?
        </h2>

        {/* Description */}
        <p className="text-charcoal text-base max-w-md mx-auto mb-8 leading-relaxed font-normal">
          Únete a compradores en toda España que ya usan AutoMisho para ahorrar tiempo, dinero y evitar vicios ocultos.
        </p>

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mb-8"
        >
          <Link
            href="/register"
            className="btn-primary text-base py-3.5 px-8 font-medium inline-flex items-center gap-2"
          >
            <span>Empezar ahora — es gratis</span>
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-signal-blue text-xs">
              →
            </span>
          </Link>
        </motion.div>

        {/* Trust badges */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.45 }}
          className="flex flex-wrap justify-center gap-6 text-xs text-ash"
        >
          <span className="flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-signal-blue">
              <path d="M3.5 7 L6 9.5 L10.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Sin tarjeta de crédito requerida
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-signal-blue">
              <path d="M3.5 7 L6 9.5 L10.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Cancela o cambia de plan en cualquier momento
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-signal-blue">
              <path d="M3.5 7 L6 9.5 L10.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Soporte técnico especializado en España
          </span>
        </motion.div>
      </motion.div>
    </section>
  );
}
