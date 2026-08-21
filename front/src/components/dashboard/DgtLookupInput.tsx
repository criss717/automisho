"use client";

import { useState } from "react";

interface DgtResult {
  plate: string;
  make: string;
  model: string;
  year: number;
  fuel: string;
  power: string;
  enrollmentDate: string;
  itvStatus: string;
  source: string;
}

export default function DgtLookupInput() {
  const [plate, setPlate] = useState("");
  const [result, setResult] = useState<DgtResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLookup = async () => {
    if (!plate.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/dgt/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plate: plate.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Error al consultar la DGT.");
        return;
      }

      setResult(data);
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card">
      <p className="text-xs uppercase tracking-wider text-mint-glow/60 mb-5">
        Consulta DGT
      </p>

      <div className="flex gap-2 mb-4">
        <input
          suppressHydrationWarning
          type="text"
          value={plate}
          onChange={(e) => setPlate(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && handleLookup()}
          placeholder="0000-BCD"
          maxLength={9}
          className="flex-1 glass-input px-4 py-2.5 text-sm text-pure-light placeholder:text-mist-gray/40 focus:outline-none focus:border-mint-glow/40 transition-colors"
        />
        <button
          suppressHydrationWarning
          onClick={handleLookup}
          disabled={loading || !plate.trim()}
          className="shrink-0 px-4 py-2.5 rounded-lg bg-mint-glow text-forest-depths text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:shadow-[0_0_12px_rgba(151,252,215,0.4)] transition-all"
        >
          {loading ? "..." : "Buscar"}
        </button>
      </div>

      {error && (
        <div className="text-xs text-red-400/80 bg-red-400/5 border border-red-400/10 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 mb-3">
            {result.source === "mock" ? (
              <span className="tag text-[10px]">Demo — datos de ejemplo</span>
            ) : (
              <span className="tag bg-mint-glow text-forest-depths border-mint-glow text-[10px]">Oficial — DGT</span>
            )}
            {result.source === "mock" && (
              <span className="text-[11px] text-mist-gray/50">Informe de demostración, para oficial usa DGTGuideCard</span>
            )}
          </div>
          <div className="flex justify-between">
            <span className="text-mist-gray/60">Matrícula</span>
            <span className="text-pure-light font-medium">{result.plate}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-mist-gray/60">Marca / Modelo</span>
            <span className="text-pure-light">{result.make} {result.model}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-mist-gray/60">Año</span>
            <span className="text-pure-light">{result.year}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-mist-gray/60">Combustible</span>
            <span className="text-pure-light">{result.fuel}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-mist-gray/60">Potencia</span>
            <span className="text-pure-light">{result.power}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-mist-gray/60">ITV</span>
            <span className={result.itvStatus === "Vigente" ? "text-green-400" : "text-red-400"}>
              {result.itvStatus}
            </span>
          </div>
          <p className="text-[10px] text-mist-gray/30 pt-2 border-t border-midnight-tide">
            Fuente: {result.source === "mock" ? "Datos de ejemplo (backend pendiente)" : result.source}
          </p>
        </div>
      )}
    </div>
  );
}
