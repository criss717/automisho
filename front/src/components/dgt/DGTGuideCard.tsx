"use client";

interface Props {
  plate?: string;
  vin?: string;
}

export default function DGTGuideCard({ plate }: Props) {
  return (
    <div className="glass-card">
      <span className="tag">Oficial DGT — 8,67 € (tasa 4.1)</span>
      <h3 className="text-heading-sm text-pure-light font-teodor mt-3">Informe oficial DGT</h3>
      <p className="text-caption text-mist-gray/70 mt-1">La única fuente 100% oficial. Recomendado antes de comprar.</p>
      <ol className="list-decimal ml-4 mt-4 text-sm text-mist-gray space-y-2">
        <li>
          Entra en{" "}
          <a
            href="https://sede.dgt.gob.es/es/vehiculos/informe-de-vehiculo/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-mint-glow hover:text-pure-light"
          >
            sede.dgt.gob.es — Informe de vehículo
          </a>
        </li>
        <li>Identifícate con Cl@ve o certificado digital</li>
        <li>Paga tasa 4.1 (8,67 €) con tarjeta</li>
        <li>Descarga PDF: revisa titulares, cargas/embargos, ITV, km, bajas y si tiene reserva de dominio</li>
      </ol>
      {plate && (
        <p className="text-caption text-mist-gray/50 mt-3">
          Matrícula consultada: <strong className="text-pure-light">{plate}</strong> (demo arriba)
        </p>
      )}
      <a
        href="https://sede.dgt.gob.es/es/vehiculos/informe-de-vehiculo/"
        target="_blank"
        rel="noopener noreferrer"
        className="btn-primary mt-5 inline-flex"
      >
        Ir a Sede DGT
      </a>
    </div>
  );
}
