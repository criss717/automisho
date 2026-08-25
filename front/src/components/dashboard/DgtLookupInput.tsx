"use client";

import { useState } from "react";

interface DgtResult {
  plate: string;
  make?: string;
  model?: string;
  year?: number;
  fuel?: string;
  power?: string;
  enrollmentDate?: string;
  itvStatus?: string;
  source?: string;
  environmentalBadge?: string;
  statusDescription?: string;
}

export default function DgtLookupInput() {
  const [plate, setPlate] = useState("");
  const [result, setResult] = useState<DgtResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfSuccess, setPdfSuccess] = useState<{ filename: string; base64: string } | null>(null);

  const handleLookup = async () => {
    if (!plate.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setPdfSuccess(null);

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

  const handleRequestFullReport = async () => {
    const targetPlate = (plate || result?.plate || "").trim().toUpperCase();
    if (!targetPlate) {
      setError("Introduce una matrícula primero (ej. 0000BBB para pruebas)");
      return;
    }

    setPdfLoading(true);
    setError(null);
    setPdfSuccess(null);

    try {
      const res = await fetch("/api/dgt/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plate: targetPlate, allowAlreadyAsked: true }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || data.error || "No se pudo generar el informe completo.");
        return;
      }

      if (data.pdfBase64) {
        setPdfSuccess({
          filename: data.pdfFilename || `informe_dgt_${targetPlate}.pdf`,
          base64: data.pdfBase64,
        });
      }
    } catch (err) {
      setError(`Error de comunicación al solicitar informe: ${err}`);
    } finally {
      setPdfLoading(false);
    }
  };

  const downloadPdf = () => {
    if (!pdfSuccess?.base64) return;
    const link = document.createElement("a");
    link.href = `data:application/pdf;base64,${pdfSuccess.base64}`;
    link.download = pdfSuccess.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="glass-card flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-2 mb-4">
          <p className="text-xs uppercase tracking-wider text-mint-glow/80 font-medium">
            Consulta DGT
          </p>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-mint-glow/10 border border-mint-glow/20 text-mint-glow">
            InfoCoche API Ready
          </span>
        </div>

        <div className="flex gap-2 mb-3">
          <input
            suppressHydrationWarning
            type="text"
            value={plate}
            onChange={(e) => setPlate(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleLookup()}
            placeholder="0000-BCD"
            maxLength={9}
            className="flex-1 glass-input px-3.5 py-2 text-sm text-pure-light placeholder:text-mist-gray/40 focus:outline-none focus:border-mint-glow/40 transition-colors"
          />
          <button
            suppressHydrationWarning
            onClick={handleLookup}
            disabled={loading || !plate.trim()}
            className="shrink-0 px-3.5 py-2 rounded-xl bg-mint-glow text-forest-depths text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed hover:shadow-[0_0_12px_rgba(151,252,215,0.4)] transition-all"
          >
            {loading ? "..." : "Buscar"}
          </button>
        </div>

        {error && (
          <div className="text-xs text-red-400/90 bg-red-400/10 border border-red-400/20 rounded-xl px-3 py-2 mb-3 leading-relaxed">
            {error}
          </div>
        )}

        {result && (
          <div className="space-y-2 text-xs bg-forest-depths/40 rounded-xl p-3 border border-white/5 mb-3">
            <div className="flex items-center justify-between pb-1.5 border-b border-white/5">
              <span className="text-mist-gray/70">Matrícula</span>
              <span className="text-pure-light font-bold text-sm tracking-wider">{result.plate}</span>
            </div>

            {result.make && (
              <div className="flex justify-between">
                <span className="text-mist-gray/60">Vehículo</span>
                <span className="text-pure-light font-medium">{result.make} {result.model}</span>
              </div>
            )}

            {result.year && (
              <div className="flex justify-between">
                <span className="text-mist-gray/60">Año estimado</span>
                <span className="text-pure-light">{result.year}</span>
              </div>
            )}

            {result.fuel && (
              <div className="flex justify-between">
                <span className="text-mist-gray/60">Combustible</span>
                <span className="text-pure-light capitalize">{result.fuel}</span>
              </div>
            )}

            {result.itvStatus && (
              <div className="flex justify-between">
                <span className="text-mist-gray/60">ITV</span>
                <span className={result.itvStatus.toLowerCase().includes("vigente") ? "text-emerald-400 font-medium" : "text-amber-400 font-medium"}>
                  {result.itvStatus}
                </span>
              </div>
            )}
          </div>
        )}

        {pdfSuccess && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs mb-3 space-y-2">
            <div className="flex items-center gap-2 text-emerald-300 font-medium">
              <span>✓</span>
              <span>¡Informe DGT Oficial Generado!</span>
            </div>
            <p className="text-[11px] text-mist-gray/80">
              El PDF oficial completo de antecedentes ha sido emitido con éxito.
            </p>
            <button
              onClick={downloadPdf}
              className="w-full py-2 px-3 rounded-lg bg-emerald-500 text-forest-depths font-semibold text-xs flex items-center justify-center gap-2 hover:bg-emerald-400 transition-colors"
            >
              <span>📥 Descargar {pdfSuccess.filename}</span>
            </button>
          </div>
        )}
      </div>

      <div className="pt-2 border-t border-white/5 flex flex-col gap-2">
        <button
          onClick={handleRequestFullReport}
          disabled={pdfLoading || (!plate.trim() && !result?.plate)}
          className="w-full py-2 px-3 rounded-xl bg-midnight-tide border border-mint-glow/30 text-mint-glow hover:bg-mint-glow/10 font-medium text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {pdfLoading ? (
            <span>⏳ Generando informe oficial DGT (10-30s)...</span>
          ) : (
            <span>📄 Solicitar Informe Completo DGT Oficial</span>
          )}
        </button>

        <p className="text-[10px] text-mist-gray/40 text-center">
          En entorno de pruebas usa matrículas <code>0000BBB</code> a <code>0009BBB</code> sin coste de créditos.
        </p>
      </div>
    </div>
  );
}
