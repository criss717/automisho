"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import AutoMishoCat from "./icons/AutoMishoCat";

const navLinks = [
  { label: "Cómo funciona", href: "#how-it-works" },
  { label: "Funciones", href: "#features" },
  { label: "Demo", href: "#demo" },
  { label: "Precios", href: "#pricing" },
];

export default function Navbar() {
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="fixed top-4 sm:top-5 left-0 right-0 z-50 px-3 sm:px-6 pointer-events-none">
      <motion.nav
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="pointer-events-auto max-w-4xl mx-auto nav-pill px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between"
      >
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 text-decoration-none group">
          <div className="w-8 h-8 rounded-full border border-mist bg-linen flex items-center justify-center overflow-hidden group-hover:border-signal-blue transition-colors">
            <AutoMishoCat size={24} interactive={false} />
          </div>
          <span className="text-graphite font-ppmondwest text-lg font-normal tracking-tight">
            AutoMisho
          </span>
        </Link>

        {/* Desktop Links */}
        <div className="hidden md:flex items-center gap-6 text-[15px] font-medium text-charcoal">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-charcoal hover:text-ink-black transition-colors"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Actions */}
        <div className="hidden md:flex items-center gap-3">
          {session?.user ? (
            <div className="flex items-center gap-3">
              <Link
                href="/chat"
                className="text-[15px] font-medium text-charcoal hover:text-ink-black transition-colors"
              >
                Chat
              </Link>
              <Link
                href="/dashboard"
                className="flex items-center gap-2"
              >
                <span className="tag text-[11px]">
                  {session.user.plan === "free" && "Gratis"}
                  {session.user.plan === "premium" && "Premium"}
                  {session.user.plan === "pro" && "Pro"}
                </span>
                <div className="w-7 h-7 rounded-full bg-twilight text-white flex items-center justify-center text-xs font-medium">
                  {session.user.name?.[0]?.toUpperCase() || "U"}
                </div>
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <Link
                href="/login"
                className="text-[15px] font-medium text-charcoal hover:text-ink-black px-3 py-1.5 transition-colors"
              >
                Entrar
              </Link>
              <Link
                href="/register"
                className="btn-primary text-sm py-1.5 px-3.5 flex items-center gap-1.5"
              >
                <span>Empezar Gratis</span>
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-signal-blue text-[10px]">
                  →
                </span>
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Hamburger */}
        <div className="md:hidden flex items-center gap-2">
          {session?.user ? (
            <Link href="/chat" className="btn-primary text-xs py-1 px-2.5">
              Chat
            </Link>
          ) : (
            <Link href="/register" className="btn-primary text-xs py-1 px-2.5">
              Probar
            </Link>
          )}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="w-8 h-8 rounded-lg border border-mist flex items-center justify-center text-charcoal hover:text-ink-black"
            aria-label="Abrir menú"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {mobileOpen ? (
                <path d="M18 6L6 18M6 6l12 12" />
              ) : (
                <path d="M4 8h16M4 16h16" />
              )}
            </svg>
          </button>
        </div>
      </motion.nav>

      {/* Mobile Dropdown */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="pointer-events-auto md:hidden mt-2 max-w-sm mx-auto bg-paper border border-mist rounded-2xl p-4 shadow-lg flex flex-col gap-3 text-sm"
          >
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="text-charcoal hover:text-ink-black py-1 px-2 rounded hover:bg-linen font-medium"
              >
                {link.label}
              </a>
            ))}
            <div className="border-t border-mist pt-2 flex flex-col gap-2">
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="btn-secondary text-center text-xs py-2"
              >
                Iniciar Sesión
              </Link>
              <Link
                href="/register"
                onClick={() => setMobileOpen(false)}
                className="btn-primary text-center text-xs py-2"
              >
                Empezar Gratis →
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
