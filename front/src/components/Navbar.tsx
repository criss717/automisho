"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";

const navLinks = [
  { label: "Cómo funciona", href: "#how-it-works" },
  { label: "Funciones", href: "#features" },
  { label: "Demo", href: "#demo" },
  { label: "Precios", href: "#pricing" },
];

export default function Navbar() {
  const { data: session } = useSession();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <motion.nav
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-500 bg-forest-depths/90 backdrop-blur-xl border-b border-midnight-tide"
    >
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 2rem", height: "80px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {/* Logo */}
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: "12px", textDecoration: "none" }}>
          <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "rgba(151,252,215,0.1)", border: "1px solid rgba(151,252,215,0.3)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            <img
              src="/assets/hero_logo.svg"
              alt="AutoMisho"
              style={{ width: "28px", height: "28px", objectFit: "contain" }}
            />
          </div>
          <span style={{ color: "#ffffff", fontSize: "18px", fontWeight: 400 }}>
            AutoMisho
          </span>
        </Link>

        {/* Desktop Nav */}
        <div style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              style={{ color: "#b0c5c1", textDecoration: "none", fontSize: "16px", fontWeight: 300 }}
            >
              {link.label}
            </a>
          ))}

          {session?.user ? (
            <div className="flex items-center gap-3">
              <Link
                href="/chat"
                className="text-body-sm text-mist-gray hover:text-mint-glow transition-colors"
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
                <div className="w-8 h-8 rounded-full bg-midnight-tide flex items-center justify-center text-mint-glow text-caption font-medium">
                  {session.user.name?.[0]?.toUpperCase() || "U"}
                </div>
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="text-body-sm text-mist-gray hover:text-mint-glow transition-colors"
              >
                Entrar
              </Link>
              <Link
                href="/register"
                style={{
                  background: "#97fcd7",
                  color: "#072724",
                  padding: "10px 24px",
                  borderRadius: "60px",
                  fontSize: "14px",
                  fontWeight: 500,
                  textDecoration: "none",
                  display: "inline-block",
                  whiteSpace: "nowrap",
                }}
              >
                Empezar Gratis
              </Link>
            </div>
          )}
        </div>
      </div>
    </motion.nav>
  );
}
