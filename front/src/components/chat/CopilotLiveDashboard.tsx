"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import CarResultCard from "./CarResultCard";
import NutSpinner from "../icons/NutSpinner";
import type { CarResult } from "@/types";

interface CopilotLiveDashboardProps {
  cars: CarResult[];
  isLoading?: boolean;
  onAskCopilot?: (question: string) => void;
}

type SortOption = "score" | "price_asc" | "year_desc" | "km_asc";
type FuelFilter = "all" | "diesel" | "gasolina" | "hibrido";
type PortalFilter = "all" | "autoscout24" | "coches.net" | "wallapop" | "milanuncios";

export default function CopilotLiveDashboard({
  cars,
  isLoading = false,
  onAskCopilot,
}: CopilotLiveDashboardProps) {
  const [sortBy, setSortBy] = useState<SortOption>("score");
  const [fuelFilter, setFuelFilter] = useState<FuelFilter>("all");
  const [portalFilter, setPortalFilter] = useState<PortalFilter>("all");

  const portalCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: cars.length,
      autoscout24: 0,
      "coches.net": 0,
      wallapop: 0,
      milanuncios: 0,
    };
    for (const c of cars) {
      const src = (c.source || "").toLowerCase();
      if (src.includes("autoscout")) counts.autoscout24++;
      else if (src.includes("coches")) counts["coches.net"]++;
      else if (src.includes("wallapop")) counts.wallapop++;
      else if (src.includes("milanuncios")) counts.milanuncios++;
    }
    return counts;
  }, [cars]);

  const filteredAndSortedCars = useMemo(() => {
    let list = [...cars];

    // Filter by portal source
    if (portalFilter !== "all") {
      list = list.filter((c) => {
        const src = (c.source || "").toLowerCase();
        if (portalFilter === "autoscout24") return src.includes("autoscout");
        if (portalFilter === "coches.net") return src.includes("coches");
        if (portalFilter === "wallapop") return src.includes("wallapop");
        if (portalFilter === "milanuncios") return src.includes("milanuncios");
        return true;
      });
    }

    // Filter by fuel
    if (fuelFilter !== "all") {
      list = list.filter((c) => {
        const f = (c.fuel || "").toLowerCase();
        if (fuelFilter === "diesel") return f.includes("diésel") || f.includes("diesel");
        if (fuelFilter === "gasolina") return f.includes("gasolina");
        if (fuelFilter === "hibrido") return f.includes("híbrido") || f.includes("hibrido") || f.includes("eco");
        return true;
      });
    }

    // Sort
    list.sort((a, b) => {
      const priceA = typeof a.price === "number" ? a.price : 999999;
      const priceB = typeof b.price === "number" ? b.price : 999999;
      const scoreA = typeof a.score === "number" ? a.score : 0;
      const scoreB = typeof b.score === "number" ? b.score : 0;
      const yearA = typeof a.year === "number" ? a.year : 0;
      const yearB = typeof b.year === "number" ? b.year : 0;
      const kmA = typeof a.km === "number" ? a.km : 999999;
      const kmB = typeof b.km === "number" ? b.km : 999999;

      if (sortBy === "score") return scoreB - scoreA;
      if (sortBy === "price_asc") return priceA - priceB;
      if (sortBy === "year_desc") return yearB - yearA;
      if (sortBy === "km_asc") return kmA - kmB;
      return 0;
    });

    return list;
  }, [cars, sortBy, fuelFilter, portalFilter]);

  const stats = useMemo(() => {
    if (cars.length === 0) return null;
    const prices = cars
      .map((c) => (typeof c.price === "number" ? c.price : 0))
      .filter((p) => p > 0);
    const minPrice = prices.length > 0 ? Math.min(...prices) : null;
    const avgScore = Math.round(
      cars.reduce((acc, c) => acc + (typeof c.score === "number" ? c.score : 80), 0) / cars.length
    );
    return {
      count: cars.length,
      minPrice: minPrice ? `${minPrice.toLocaleString("es-ES")}€` : null,
      avgScore,
    };
  }, [cars]);

  return (
    <div className="h-full flex flex-col bg-forest-depths/40 border-l border-midnight-tide overflow-hidden">
      {/* Header Toolbar */}
      <div className="shrink-0 p-4 border-b border-midnight-tide bg-forest-depths/80 backdrop-blur-md">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-mint-glow/10 border border-mint-glow/30 flex items-center justify-center">
              <span className="text-mint-glow text-sm">⚡</span>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-pure-light tracking-wide">
                Copilot Live Dashboard
              </h2>
              <p className="text-[11px] text-mist-gray/60">
                {isLoading
                  ? "Buscando publicaciones en vivo..."
                  : cars.length > 0
                  ? `${cars.length} vehículos analizados con IA`
                  : "Listo para procesar búsquedas"}
              </p>
            </div>
          </div>

          {stats && !isLoading && (
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-full bg-mint-glow/10 border border-mint-glow/20 text-mint-glow font-medium">
                Desde {stats.minPrice}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-pure-light font-medium">
                Match medio: {stats.avgScore}%
              </span>
            </div>
          )}
        </div>

        {/* Portal filter tabs */}
        {cars.length > 0 && !isLoading && (
          <div className="flex flex-wrap items-center gap-1 mb-2.5 pt-1">
            {(
              [
                { id: "all", label: "Todos", count: portalCounts.all },
                { id: "autoscout24", label: "AutoScout24", count: portalCounts.autoscout24 },
                { id: "coches.net", label: "Coches.net", count: portalCounts["coches.net"] },
                { id: "wallapop", label: "Wallapop", count: portalCounts.wallapop },
                { id: "milanuncios", label: "Milanuncios", count: portalCounts.milanuncios },
              ] as const
            ).map((p) => {
              if (p.id !== "all" && p.count === 0) return null;
              return (
                <button
                  key={p.id}
                  onClick={() => setPortalFilter(p.id)}
                  className={`text-[11px] px-2.5 py-0.5 rounded-full transition-all flex items-center gap-1.5 ${
                    portalFilter === p.id
                      ? "bg-mint-glow/20 border border-mint-glow/50 text-mint-glow font-medium"
                      : "text-mist-gray/60 hover:text-pure-light border border-transparent hover:border-white/10"
                  }`}
                >
                  <span>{p.label}</span>
                  <span className="text-[9px] px-1 rounded-full bg-forest-depths/80 text-mist-gray/80">
                    {p.count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Filters and Sorting Controls */}
        {cars.length > 0 && !isLoading && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/5">
            {/* Fuel filters */}
            <div className="flex items-center gap-1">
              {(
                [
                  { id: "all", label: "Todos" },
                  { id: "diesel", label: "Diésel" },
                  { id: "gasolina", label: "Gasolina" },
                  { id: "hibrido", label: "Híbrido/ECO" },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFuelFilter(f.id)}
                  className={`text-[11px] px-2.5 py-1 rounded-full transition-all ${
                    fuelFilter === f.id
                      ? "bg-mint-glow text-forest-depths font-medium shadow-sm"
                      : "text-mist-gray/70 hover:text-pure-light hover:bg-white/5"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Sort selector */}
            <div className="flex items-center gap-1.5 text-xs text-mist-gray/70">
              <span className="text-[11px]">Ordenar:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                aria-label="Ordenar vehículos"
                className="bg-midnight-tide/80 border border-white/10 rounded-lg text-pure-light text-xs px-2 py-1 outline-none focus:border-mint-glow/40 cursor-pointer"
              >
                <option value="score">Mayor Puntuación</option>
                <option value="price_asc">Menor Precio</option>
                <option value="year_desc">Más Nuevo</option>
                <option value="km_asc">Menos Kilómetros</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 min-h-0">
        {/* Loading State with NutSpinner */}
        {isLoading && (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center">
            <div className="relative mb-6">
              <div className="w-20 h-20 rounded-full bg-mint-glow/10 border border-mint-glow/20 flex items-center justify-center">
                <NutSpinner size={42} className="text-mint-glow animate-[spin_3s_linear_infinite]" />
              </div>
              <div className="absolute inset-0 rounded-full bg-mint-glow/10 blur-xl animate-pulse" />
            </div>

            <h3 className="text-lg font-teodor text-pure-light mb-2">
              AutoMisho está analizando el mercado...
            </h3>
            <p className="text-xs text-mist-gray/70 max-w-sm leading-relaxed mb-6">
              Consultando AutoScout24, coches.net, Wallapop y Milanuncios para extraer fichas, kilometrajes reales y puntuaciones IA.
            </p>

            <div className="flex flex-wrap justify-center gap-2 max-w-xs">
              <span className="text-[10px] px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-mist-gray">
                AutoScout24
              </span>
              <span className="text-[10px] px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-mist-gray">
                coches.net
              </span>
              <span className="text-[10px] px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-mist-gray">
                Wallapop
              </span>
              <span className="text-[10px] px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-mist-gray">
                Milanuncios
              </span>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && cars.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-midnight-tide border border-white/5 flex items-center justify-center text-2xl mb-4 text-mist-gray/40">
              🚗
            </div>
            <h3 className="text-base font-teodor text-pure-light mb-1">
              Dashboard de Comparativa Dinámica
            </h3>
            <p className="text-xs text-mist-gray/60 max-w-xs leading-relaxed mb-6">
              Pídele a AutoMisho lo que necesitas en el chat (por ejemplo, presupuesto o modelo) y aquí verás la ficha comparativa con fotos, pros, contras y enlaces en directo.
            </p>

            <div className="w-full max-w-xs space-y-2">
              <p className="text-[11px] uppercase tracking-wider text-mint-glow font-medium text-left">
                Prueba pidiéndole:
              </p>
              {[
                "5 coches de 3.000€ o menos",
                "SUV diésel etiqueta C por 10.000€ o menos",
                "Compacto gasolina fiable de 6.000€ o menos",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => onAskCopilot?.(suggestion)}
                  className="w-full text-left p-2.5 rounded-xl bg-midnight-tide/50 border border-white/5 hover:border-mint-glow/30 hover:bg-midnight-tide text-xs text-mist-gray hover:text-pure-light transition-all"
                >
                  &ldquo;{suggestion}&rdquo;
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Filtered Empty State */}
        {!isLoading && cars.length > 0 && filteredAndSortedCars.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center">
            <p className="text-sm text-mist-gray/70 mb-3">
              No hay vehículos con el filtro seleccionado ({portalFilter !== "all" ? portalFilter : fuelFilter}).
            </p>
            <button
              onClick={() => {
                setFuelFilter("all");
                setPortalFilter("all");
              }}
              className="px-4 py-1.5 rounded-full bg-mint-glow text-forest-depths text-xs font-medium"
            >
              Restablecer filtros
            </button>
          </div>
        )}

        {/* Cars Grid */}
        {!isLoading && filteredAndSortedCars.length > 0 && (
          <motion.div
            layout
            className="grid grid-cols-1 xl:grid-cols-2 gap-4"
          >
            <AnimatePresence>
              {filteredAndSortedCars.map((car, idx) => (
                <motion.div
                  key={car.url || car.title + idx}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.25, delay: idx * 0.04 }}
                  layout
                >
                  <CarResultCard
                    car={car}
                    onAskCopilot={(question: string) =>
                      onAskCopilot?.(question)
                    }
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  );
}
