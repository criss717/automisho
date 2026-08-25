"use client";

import { motion } from "framer-motion";
import type { CarResult } from "@/types";

interface CarResultCardProps {
  car: CarResult;
  variant?: "compact" | "full";
  onAskCopilot?: (question: string) => void;
}

function formatPrice(price: number | string | null | undefined): string {
  if (price === null || price === undefined || price === "") return "Precio no disponible";
  if (typeof price === "number") return `${price.toLocaleString("es-ES")}€`;
  const n = parseInt(String(price).replace(/[^\d]/g, ""), 10);
  if (!isNaN(n) && String(price).match(/\d/)) return `${n.toLocaleString("es-ES")}€`;
  return String(price);
}

function formatKm(km: number | string | null | undefined): string {
  if (km === null || km === undefined || km === "") return "¿km?";
  if (typeof km === "number") return `${km.toLocaleString("es-ES")} km`;
  const n = parseInt(String(km).replace(/[^\d]/g, ""), 10);
  if (!isNaN(n)) return `${n.toLocaleString("es-ES")} km`;
  return String(km);
}

export default function CarResultCard({
  car,
  variant = "full",
  onAskCopilot,
}: CarResultCardProps) {
  const getListingUrl = () => {
    if (
      car.url &&
      car.url.startsWith("http") &&
      car.url !== "https://www.autoscout24.es" &&
      car.url !== "https://www.coches.net" &&
      car.url !== "https://es.wallapop.com" &&
      car.url !== "https://www.milanuncios.com"
    ) {
      return car.url;
    }
    const sourceLower = (car.source || "").toLowerCase();
    const query = encodeURIComponent(car.title || "");
    const maxP = typeof car.price === "number" ? car.price : "";
    if (sourceLower.includes("coches")) {
      return `https://www.coches.net/segunda-mano/?Keywords=${query}${maxP ? `&MaxPrice=${maxP}` : ""}`;
    }
    if (sourceLower.includes("autoscout")) {
      return `https://www.autoscout24.es/lst?keywords=${query}${maxP ? `&priceto=${maxP}` : ""}`;
    }
    if (sourceLower.includes("wallapop")) {
      return `https://es.wallapop.com/app/search?keywords=${query}&category_ids=100${maxP ? `&max_sale_price=${maxP}` : ""}`;
    }
    return `https://www.milanuncios.com/coches-de-segunda-mano/?keywords=${query}${maxP ? `&precio-hasta=${maxP}` : ""}`;
  };

  const href = getListingUrl();
  const priceLabel = formatPrice(car.price);
  const yearLabel = car.year ? String(car.year) : null;
  const kmLabel = formatKm(car.km);
  const locationLabel = car.location || null;
  const score = typeof car.score === "number" ? Math.min(100, Math.max(0, car.score)) : 84;

  const pros = car.pros && car.pros.length > 0 ? car.pros : [
    "Precio ajustado al presupuesto",
    "Disponibilidad con anuncio activo",
  ];

  const cons = car.cons && car.cons.length > 0 ? car.cons : [
    "Revisar historial DGT e ITV previo a compra",
  ];

  const handleAsk = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onAskCopilot) {
      onAskCopilot(`Analiza a fondo el ${car.title} por ${priceLabel} de ${car.source}. ¿Qué puntos débiles debo revisar antes de comprarlo?`);
    }
  };

  if (variant === "compact") {
    return (
      <div className="glass-card p-3 rounded-xl border border-white/5 hover:border-mint-glow/30 transition-all max-w-sm">
        <div className="flex gap-3 items-center">
          {car.image_url ? (
            <img
              src={car.image_url}
              alt={car.title}
              className="w-16 h-16 rounded-lg object-cover bg-midnight-tide shrink-0"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/assets/hero_logo.svg";
                (e.target as HTMLImageElement).className = "w-16 h-16 p-3 object-contain bg-midnight-tide rounded-lg opacity-60";
              }}
            />
          ) : (
            <div className="w-16 h-16 rounded-lg bg-midnight-tide flex items-center justify-center shrink-0">
              <img src="/assets/hero_logo.svg" alt="" className="w-8 h-8 opacity-60" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="text-[10px] px-2 py-0.5 rounded-full border border-mint-glow/30 text-mint-glow uppercase font-medium">
                {car.source}
              </span>
              <span className="text-xs text-mint-glow font-medium">{score}/100</span>
            </div>
            <h4 className="text-xs text-pure-light font-medium truncate">{car.title}</h4>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm font-teodor text-mint-glow">{priceLabel}</span>
              <span className="text-[11px] text-mist-gray/60">{yearLabel || kmLabel}</span>
            </div>
          </div>
        </div>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 block text-center text-xs text-mint-glow py-1.5 rounded-lg bg-mint-glow/10 hover:bg-mint-glow/20 border border-mint-glow/20 transition-all font-medium"
        >
          Ver anuncio en {car.source} ↗
        </a>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="glass-card p-0 rounded-2xl border border-white/8 overflow-hidden hover:border-mint-glow/30 hover:shadow-[0_0_25px_rgba(151,252,215,0.12)] transition-all flex flex-col h-full group"
    >
      {/* Header Image & Source Badge */}
      <div className="relative w-full h-44 bg-gradient-to-t from-forest-depths to-midnight-tide overflow-hidden shrink-0">
        {car.image_url ? (
          <img
            src={car.image_url}
            alt={car.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/assets/hero_logo.svg";
              (e.target as HTMLImageElement).className = "w-16 h-16 mx-auto my-14 object-contain opacity-50";
            }}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <img src="/assets/hero_logo.svg" alt="AutoMisho" className="w-12 h-12 opacity-40" />
            <span className="text-xs text-mist-gray/40">Foto no disponible en anuncio</span>
          </div>
        )}

        {/* Source badge overlay */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <span className="text-[11px] font-medium tracking-wide uppercase px-2.5 py-1 rounded-full bg-forest-depths/85 backdrop-blur-md text-mint-glow border border-mint-glow/30 shadow-sm">
            {car.source}
          </span>
        </div>

        {/* Score indicator badge */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-forest-depths/85 backdrop-blur-md border border-mint-glow/30 shadow-sm">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="text-mint-glow">
            <path d="M8 1.5l1.9 4.3 4.7.4-3.5 3.1 1 4.6L8 11.5 3.9 13.9l1-4.6-3.5-3.1 4.7-.4L8 1.5z" fill="currentColor" />
          </svg>
          <span className="text-xs font-semibold text-mint-glow">{score}/100</span>
        </div>

        {/* Price bottom overlay tag */}
        <div className="absolute bottom-3 left-3">
          <span className="text-2xl font-teodor text-pure-light drop-shadow-md bg-forest-depths/80 backdrop-blur-md px-3 py-1 rounded-xl border border-white/10">
            {priceLabel}
          </span>
        </div>
      </div>

      {/* Main Details Body */}
      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div>
          {/* Title */}
          <h3 className="text-base text-pure-light font-medium line-clamp-2 leading-snug mb-3">
            {car.title}
          </h3>

          {/* Quick Specs Chips */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-mist-gray mb-4">
            {yearLabel && (
              <span className="px-2.5 py-1 rounded-md bg-white/5 border border-white/5 flex items-center gap-1">
                📅 {yearLabel}
              </span>
            )}
            <span className="px-2.5 py-1 rounded-md bg-white/5 border border-white/5 flex items-center gap-1">
              🛣️ {kmLabel}
            </span>
            {car.fuel && (
              <span className="px-2.5 py-1 rounded-md bg-white/5 border border-white/5 flex items-center gap-1">
                ⛽ {car.fuel}
              </span>
            )}
            {locationLabel && (
              <span className="px-2.5 py-1 rounded-md bg-white/5 border border-white/5 flex items-center gap-1">
                📍 {locationLabel}
              </span>
            )}
          </div>

          {/* Match Score Meter */}
          <div className="space-y-1.5 mb-4">
            <div className="flex justify-between text-[11px]">
              <span className="text-mist-gray/70">Coincidencia IA</span>
              <span className="text-mint-glow font-medium">
                {score >= 90 ? "Excelente opción" : score >= 80 ? "Buena oportunidad" : "Revisión recomendada"}
              </span>
            </div>
            <div className="h-1.5 w-full bg-midnight-tide rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${score}%` }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="h-full rounded-full"
                style={{
                  background: "linear-gradient(to right, var(--color-teal-pulse), var(--color-mint-glow))",
                }}
              />
            </div>
          </div>

          {/* Pros (Ventajas) */}
          <div className="space-y-2 mb-3">
            <p className="text-[11px] uppercase tracking-wider text-mint-glow font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-mint-glow" />
              Ventajas detectadas:
            </p>
            <div className="space-y-1">
              {pros.map((pro, idx) => (
                <div key={idx} className="flex items-start gap-1.5 text-xs text-mist-gray/90">
                  <span className="text-mint-glow font-bold shrink-0">✓</span>
                  <span className="leading-tight">{pro}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Cons (Desventajas o Puntos a revisar) */}
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-wider text-amber-400/90 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Puntos a revisar:
            </p>
            <div className="space-y-1">
              {cons.map((con, idx) => (
                <div key={idx} className="flex items-start gap-1.5 text-xs text-mist-gray/80">
                  <span className="text-amber-400 font-bold shrink-0">⚠</span>
                  <span className="leading-tight">{con}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-3 border-t border-white/5 flex items-center gap-2">
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-2.5 px-4 rounded-xl bg-mint-glow text-forest-depths font-medium text-xs text-center hover:shadow-[0_0_15px_rgba(151,252,215,0.4)] transition-all flex items-center justify-center gap-1.5 group/btn"
          >
            <span>Ver anuncio en {car.source}</span>
            <span className="group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform">↗</span>
          </a>

          {onAskCopilot && (
            <button
              onClick={handleAsk}
              title="Preguntar a AutoMisho sobre este coche"
              className="p-2.5 rounded-xl border border-mint-glow/30 text-mint-glow hover:bg-mint-glow/10 hover:border-mint-glow/60 transition-all shrink-0 flex items-center justify-center"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
