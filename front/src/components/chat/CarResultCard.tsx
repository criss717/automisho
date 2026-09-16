"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ensureCarGallery } from "@/lib/chat-helpers";
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

  const rawImages = (car.images && car.images.length > 0)
    ? car.images
    : (car.image_url ? [car.image_url] : []);
  const images = ensureCarGallery(car, rawImages);
  const [activeImgIndex, setActiveImgIndex] = useState(0);

  const handlePrevImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveImgIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  };

  const handleNextImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveImgIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  };

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button, a")) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    if (clickX > rect.width / 2) {
      handleNextImage(e);
    } else {
      handlePrevImage(e);
    }
  };

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
      <div className="card p-3 rounded-xl border border-mist hover:border-signal-blue transition-all max-w-sm bg-paper shadow-subtle">
        <div className="flex gap-3 items-center">
          {images.length > 0 ? (
            <img
              src={images[0]}
              alt={car.title}
              className="w-16 h-16 rounded-lg object-cover bg-linen shrink-0 border border-mist"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/assets/hero_logo.svg";
                (e.target as HTMLImageElement).className = "w-16 h-16 p-3 object-contain bg-linen rounded-lg opacity-60";
              }}
            />
          ) : (
            <div className="w-16 h-16 rounded-lg bg-linen border border-mist flex items-center justify-center shrink-0">
              <img src="/assets/hero_logo.svg" alt="" className="w-8 h-8 opacity-60" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1 mb-1">
              <div className="flex items-center gap-1.5 overflow-hidden">
                <span className="text-[10px] px-2 py-0.5 rounded-full border border-mist text-ash bg-linen uppercase font-medium shrink-0">
                  {car.source}
                </span>
                {car.visualAudit?.verified3p && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-linen text-signal-blue border border-signal-blue/40 font-medium shrink-0 flex items-center gap-1">
                    👁️ 3p foto
                  </span>
                )}
                {car.visualAudit?.bodyTypeDetected && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-linen text-graphite border border-mist font-medium shrink-0 flex items-center gap-1">
                    🏎️ {car.visualAudit.bodyTypeDetected}
                  </span>
                )}
              </div>
              <span className="text-xs text-signal-blue font-medium shrink-0">{score}/100</span>
            </div>
            <h4 className="text-xs text-graphite font-medium truncate">{car.title}</h4>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm font-ppmondwest text-graphite">{priceLabel}</span>
              <span className="text-[11px] text-ash">{yearLabel || kmLabel}</span>
            </div>
          </div>
        </div>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 block text-center text-xs text-signal-blue py-1.5 rounded-lg border border-signal-blue hover:bg-signal-blue/10 transition-all font-medium"
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
      className="card p-0 rounded-2xl border border-mist overflow-hidden hover:border-signal-blue hover:shadow-md transition-all flex flex-col h-full group bg-paper shadow-subtle"
    >
      {/* Header Image Gallery & Source Badge */}
      <div
        onClick={handleImageClick}
        className="relative w-full h-48 bg-linen overflow-hidden shrink-0 select-none border-b border-mist cursor-pointer group/gallery"
      >
        <AnimatePresence mode="wait">
          {images.length > 0 ? (
            <motion.img
              key={images[activeImgIndex] || activeImgIndex}
              src={images[activeImgIndex]}
              alt={`${car.title} - imagen ${activeImgIndex + 1}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
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
              <span className="text-xs text-ash">Foto no disponible en anuncio</span>
            </div>
          )}
        </AnimatePresence>

        {/* Interactive Navigation Arrows for Gallery */}
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrevImage}
              aria-label="Foto anterior"
              title="Foto anterior (o haz clic en el lado izquierdo)"
              className="absolute left-2.5 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-paper/95 hover:bg-paper text-graphite border border-mist flex items-center justify-center opacity-90 hover:opacity-100 hover:scale-110 active:scale-95 transition-all shadow-md cursor-pointer"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <button
              type="button"
              onClick={handleNextImage}
              aria-label="Siguiente foto"
              title="Siguiente foto (o haz clic en el lado derecho)"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-paper/95 hover:bg-paper text-graphite border border-mist flex items-center justify-center opacity-90 hover:opacity-100 hover:scale-110 active:scale-95 transition-all shadow-md cursor-pointer"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>

            {/* Pagination Dots */}
            <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 bg-paper/90 px-2.5 py-1 rounded-full border border-mist shadow-sm">
              {images.map((_, dotIdx) => (
                <button
                  key={dotIdx}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setActiveImgIndex(dotIdx);
                  }}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                    dotIdx === activeImgIndex
                      ? "w-4 bg-signal-blue"
                      : "w-1.5 bg-fog hover:bg-ash"
                  }`}
                  aria-label={`Ver foto ${dotIdx + 1}`}
                />
              ))}
            </div>

            {/* Photo Counter Badge */}
            <div className="absolute bottom-2.5 right-3 z-20 flex items-center gap-1 bg-paper/90 px-2 py-0.5 rounded-full border border-mist text-[10px] text-graphite font-medium shadow-sm">
              <span>{activeImgIndex + 1}/{images.length}</span>
            </div>
          </>
        )}

        {/* Badges Overlays */}
        <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-1.5 max-w-[70%]">
          <span className="text-[11px] font-medium tracking-wide uppercase px-2.5 py-1 rounded-full bg-paper/95 text-graphite border border-mist shadow-sm">
            {car.source}
          </span>
          {car.visualAudit?.verified3p && (
            <span className="text-[10px] font-medium tracking-wide px-2 py-0.5 rounded-full bg-paper/95 text-signal-blue border border-signal-blue/50 shadow-sm flex items-center gap-1">
              👁️ 3p Verificado
            </span>
          )}
          {car.visualAudit?.bodyTypeDetected && (
            <span className="text-[10px] font-medium tracking-wide px-2 py-0.5 rounded-full bg-paper/95 text-graphite border border-mist shadow-sm flex items-center gap-1">
              🏎️ {car.visualAudit.bodyTypeDetected}
            </span>
          )}
          {car.visualAudit?.colorDetected && (
            <span className="text-[10px] font-medium tracking-wide px-2 py-0.5 rounded-full bg-paper/95 text-graphite border border-mist shadow-sm flex items-center gap-1">
              🎨 {car.visualAudit.colorDetected}
            </span>
          )}
          {car.visualAudit?.flipOpportunity?.flipPotential && ["Alto", "Medio"].includes(car.visualAudit.flipOpportunity.flipPotential) && (
            <span className="text-[10px] font-semibold tracking-wide px-2 py-0.5 rounded-full bg-linen text-signal-blue border border-signal-blue shadow-sm flex items-center gap-1">
              💰 Reventa: {car.visualAudit.flipOpportunity.flipPotential}
            </span>
          )}
        </div>

        {/* Score indicator badge */}
        <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-paper/95 border border-mist shadow-sm">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="text-signal-blue">
            <path d="M8 1.5l1.9 4.3 4.7.4-3.5 3.1 1 4.6L8 11.5 3.9 13.9l1-4.6-3.5-3.1 4.7-.4L8 1.5z" fill="currentColor" />
          </svg>
          <span className="text-xs font-semibold text-graphite">{score}/100</span>
        </div>

        {/* Price bottom overlay tag */}
        <div className="absolute bottom-3 left-3 z-10">
          <span className="text-2xl font-ppmondwest text-graphite drop-shadow-sm bg-paper/95 px-3 py-1 rounded-xl border border-mist">
            {priceLabel}
          </span>
        </div>
      </div>

      {/* Main Details Body */}
      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div>
          {/* Title */}
          <h3 className="text-base text-graphite font-medium line-clamp-2 leading-snug mb-3">
            {car.title}
          </h3>

          {/* Quick Specs Chips */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-charcoal mb-3">
            {car.doors && (
              <span className="px-2.5 py-1 rounded-md bg-linen border border-mist flex items-center gap-1">
                🚪 {car.doors}p
              </span>
            )}
            {yearLabel && (
              <span className="px-2.5 py-1 rounded-md bg-linen border border-mist flex items-center gap-1">
                📅 {yearLabel}
              </span>
            )}
            <span className="px-2.5 py-1 rounded-md bg-linen border border-mist flex items-center gap-1">
              🛣️ {kmLabel}
            </span>
            {car.fuel && (
              <span className="px-2.5 py-1 rounded-md bg-linen border border-mist flex items-center gap-1">
                ⛽ {car.fuel}
              </span>
            )}
            {locationLabel && (
              <span className="px-2.5 py-1 rounded-md bg-linen border border-mist flex items-center gap-1">
                📍 {locationLabel}
              </span>
            )}
          </div>

          {/* Visual AI Audit Highlight (Body & Match Notes) */}
          {(car.visualAudit?.bodyCondition || car.visualAudit?.criteriaNotes) && (
            <div className="mb-3.5 p-3 rounded-xl bg-linen border border-mist text-xs text-charcoal flex items-start gap-2 shadow-inner">
              <span className="shrink-0 text-signal-blue text-sm">👁️</span>
              <div className="leading-snug space-y-0.5">
                <span className="font-semibold text-graphite">Auditoría Visual IA: </span>
                {car.visualAudit.criteriaNotes && (
                  <span className="text-graphite block">{car.visualAudit.criteriaNotes}</span>
                )}
                {car.visualAudit.bodyCondition && (
                  <span className="text-charcoal block">{car.visualAudit.bodyCondition}</span>
                )}
              </div>
            </div>
          )}

          {/* Flip / Resale Opportunity Card */}
          {car.visualAudit?.flipOpportunity?.flipPotential && ["Alto", "Medio"].includes(car.visualAudit.flipOpportunity.flipPotential) && (
            <div className="mb-3.5 p-3 rounded-xl bg-linen border border-mist text-xs text-charcoal flex items-start gap-2 shadow-inner">
              <span className="shrink-0 text-signal-blue text-sm">📈</span>
              <div className="leading-snug space-y-1 w-full">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-graphite">Oportunidad Reventa / Negocio:</span>
                  <span className="px-1.5 py-0.5 rounded bg-paper border border-signal-blue text-signal-blue font-bold text-[10px]">
                    {car.visualAudit.flipOpportunity.flipPotential} potencial
                  </span>
                </div>
                <p className="text-[11px] text-charcoal">
                  <strong>Estado:</strong> {car.visualAudit.flipOpportunity.damageSummary || "Sin daños visibles"}
                  {car.visualAudit.flipOpportunity.estimatedRepairCost && ` • Reparación est.: ${car.visualAudit.flipOpportunity.estimatedRepairCost}`}
                </p>
              </div>
            </div>
          )}

          {/* Match Score Meter */}
          <div className="space-y-1.5 mb-4">
            <div className="flex justify-between text-[11px]">
              <span className="text-ash">Coincidencia IA</span>
              <span className="text-signal-blue font-medium">
                {score >= 90 ? "Excelente opción" : score >= 80 ? "Buena oportunidad" : "Revisión recomendada"}
              </span>
            </div>
            <div className="h-1.5 w-full bg-mist rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${score}%` }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="h-full rounded-full bg-signal-blue"
              />
            </div>
          </div>

          {/* Pros (Ventajas) */}
          <div className="space-y-2 mb-3">
            <p className="text-[11px] uppercase tracking-wider text-graphite font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-signal-blue" />
              Ventajas detectadas:
            </p>
            <div className="space-y-1">
              {pros.map((pro, idx) => (
                <div key={idx} className="flex items-start gap-1.5 text-xs text-charcoal">
                  <span className="text-signal-blue font-bold shrink-0">✓</span>
                  <span className="leading-tight">{pro}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Cons (Desventajas o Puntos a revisar) */}
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-wider text-charcoal font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-ash" />
              Puntos a revisar:
            </p>
            <div className="space-y-1">
              {cons.map((con, idx) => (
                <div key={idx} className="flex items-start gap-1.5 text-xs text-ash">
                  <span className="text-ash font-bold shrink-0">⚠</span>
                  <span className="leading-tight">{con}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-3 border-t border-mist flex items-center gap-2">
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary flex-1 py-2 px-3 text-xs font-medium text-center flex items-center justify-center gap-1.5 group/btn"
          >
            <span>Ver anuncio en {car.source}</span>
            <span className="group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform">↗</span>
          </a>

          {onAskCopilot && (
            <button
              onClick={handleAsk}
              title="Preguntar a AutoMisho sobre este coche"
              className="btn-secondary p-2 rounded-lg text-xs shrink-0 flex items-center justify-center"
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
