"use client";

import Link from "next/link";
import AutoMishoCat from "./icons/AutoMishoCat";

const footerLinks = [
  {
    title: "Producto",
    links: [
      { label: "Cómo funciona", href: "#how-it-works" },
      { label: "Funciones", href: "#features" },
      { label: "Precios", href: "#pricing" },
      { label: "Demo interactiva", href: "#demo" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacidad", href: "#" },
      { label: "Términos de uso", href: "#" },
      { label: "Política de Cookies", href: "#" },
    ],
  },
  {
    title: "Contacto",
    links: [
      { label: "Soporte al comprador", href: "#" },
      { label: "Comunidad", href: "#" },
      { label: "info@automisho.es", href: "mailto:info@automisho.es" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="bg-paper border-t border-mist mt-16">
      <div className="max-w-6xl mx-auto px-4 py-16 sm:py-20">
        {/* Editorial Statement */}
        <div className="mb-14 pb-12 border-b border-mist max-w-2xl">
          <p className="font-ppmondwest text-2xl sm:text-3xl text-graphite font-normal leading-snug tracking-tight mb-3">
            “El mercado del automóvil de segunda mano no necesita más anuncios confusos; necesita criterio honesto, ojos atentos y datos verificados.”
          </p>
          <span className="text-xs text-ash tracking-wide uppercase font-medium">
            AutoMisho — Cuaderno editorial de inteligencia artificial
          </span>
        </div>

        {/* Links Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          {/* Brand Col */}
          <div>
            <Link href="/" className="flex items-center gap-2.5 mb-4 group text-decoration-none">
              <div className="w-8 h-8 rounded-full border border-mist bg-linen flex items-center justify-center overflow-hidden">
                <AutoMishoCat size={24} interactive={false} />
              </div>
              <span className="font-ppmondwest text-xl text-graphite font-normal">
                AutoMisho
              </span>
            </Link>
            <p className="text-sm text-ash leading-relaxed max-w-xs font-normal">
              Tu copiloto con visión artificial y acceso a portales y datos de la DGT para comprar con tranquilidad.
            </p>
          </div>

          {/* Columns */}
          {footerLinks.map((group) => (
            <div key={group.title}>
              <h4 className="text-xs font-medium text-graphite uppercase tracking-wider mb-4">
                {group.title}
              </h4>
              <ul className="space-y-2.5">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-charcoal hover:text-ink-black transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Colophon & Bottom Bar */}
        <div className="border-t border-mist pt-6 flex flex-wrap justify-between items-center gap-4 text-xs text-ash">
          <p>© {new Date().getFullYear()} AutoMisho Inc. Todos los derechos reservados.</p>
          <p className="flex items-center gap-1">
            Diseñado con precisión editorial en España
          </p>
        </div>
      </div>
    </footer>
  );
}
