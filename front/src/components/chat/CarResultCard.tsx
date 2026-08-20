"use client";

import { motion } from "framer-motion";
import type { CarResult } from "@/types";

function formatPrice(price: number | string | null | undefined): string {
  if (price === null || price === undefined || price === "") return "Precio no disponible";
  if (typeof price === "number") return `${price.toLocaleString("es-ES")}€`;
  const n = parseInt(String(price).replace(/[^\d]/g, ""), 10);
  if (!isNaN(n) && String(price).match(/\d/)) return `${n.toLocaleString("es-ES")}€`;
  return String(price);
}

function formatKm(km: number | string | null | undefined): string {
  if (km === null || km === undefined || km === "") return "¿km?";
  if (typeof km === "number") return `${km.toLocaleString("es-ES")}km`;
  const n = parseInt(String(km).replace(/[^\d]/g, ""), 10);
  if (!isNaN(n)) return `${n.toLocaleString("es-ES")}km`;
  return String(km);
}

export default function CarResultCard({ car }: { car: CarResult }) {
  const href = car.url || "#";
  const hasLink = Boolean(car.url);
  const priceLabel = formatPrice(car.price);
  const yearLabel = car.year ? String(car.year) : "¿?";
  const kmLabel = formatKm(car.km);
  const locationLabel = car.location || "";
  const score = typeof car.score === "number" ? car.score : null;

  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) =>
    hasLink ? (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="block max-w-[320px] glass-card p-0 overflow-hidden hover:border-mint-glow/30 transition-all"
      >
        {children}
      </a>
    ) : (
      <div className="glass-card p-0 overflow-hidden max-w-[320px]">{children}</div>
    ) as unknown as React.FC<{ children: React.ReactNode }>;

  return (
    <Wrapper>
      <div className="p-4">
        {car.image_url && (
          <div className="relative w-full h-36 mb-3 rounded-lg overflow-hidden bg-midnight-tide">
            {/* Use plain img with fallback; next/image requires remotePatterns which we have, but img is simpler for error handling */}
            <img
              src={car.image_url}
              alt={car.title}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <span className="absolute top-2 right-2 text-[10px] border border-mint-glow text-mint-glow bg-forest-depths/80 backdrop-blur rounded-full px-2 py-0.5">
              {car.source}
            </span>
          </div>
        )}
        {!car.image_url && (
          <div className="flex justify-between items-start mb-2">
            <h4 className="text-body-sm text-pure-light font-medium line-clamp-2 flex-1 mr-2">{car.title}</h4>
            <span className="text-[10px] border border-mint-glow text-mint-glow rounded-full px-2 py-0.5 shrink-0">
              {car.source}
            </span>
          </div>
        )}
        {car.image_url && (
          <h4 className="text-body-sm text-pure-light font-medium line-clamp-2 mb-2">{car.title}</h4>
        )}

        <div className="flex items-center gap-4 mb-3">
          <span className="text-[28px] text-mint-glow font-teodor leading-none">{priceLabel}</span>
          <div className="flex items-center gap-2 text-mist-gray text-caption flex-wrap">
            <span>{yearLabel}</span>
            <span>·</span>
            <span>{kmLabel}</span>
            {locationLabel && (
              <>
                <span>·</span>
                <span>{locationLabel}</span>
              </>
            )}
            {car.fuel && (
              <>
                <span>·</span>
                <span>{car.fuel}</span>
              </>
            )}
          </div>
        </div>

        {score !== null && (
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-midnight-tide rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, Math.max(0, score))}%` }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className="h-full rounded-full"
                style={{
                  background: "linear-gradient(to right, var(--color-teal-pulse), var(--color-mint-glow))",
                }}
              />
            </div>
            <span className="text-caption text-mint-glow">{score}/100</span>
          </div>
        )}

        {car.alerts === 0 && (
          <p className="text-caption text-mint-glow mt-2 flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M3 6 L5 8 L9 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Sin alertas rojas detectadas
          </p>
        )}

        {typeof car.alerts === "number" && car.alerts > 0 && (
          <p className="text-caption text-amber-400 mt-2 flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 3v4M6 9v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            {car.alerts} alerta{car.alerts > 1 ? "s" : ""} detectada{car.alerts > 1 ? "s" : ""}
          </p>
        )}

        {hasLink && (
          <p className="text-[11px] text-mist-gray/40 mt-3 flex items-center gap-1">
            Ver anuncio →
          </p>
        )}
      </div>
    </Wrapper>
  );
}
