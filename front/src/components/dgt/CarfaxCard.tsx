"use client";

interface Props {
  vin?: string;
  plate?: string;
}

export default function CarfaxCard({ vin }: Props) {
  return (
    <div className="glass-card">
      <span className="tag">Carfax — ~20 €</span>
      <h3 className="text-heading-sm text-pure-light font-teodor mt-3">Informe Carfax</h3>
      <p className="text-caption text-mist-gray/70 mt-1">Histórico amplio USA/EU para VIN.</p>
      <ul className="list-disc ml-4 mt-4 text-sm text-mist-gray space-y-1">
        <li>Historial de propietarios y mantenimiento</li>
        <li>Kilometraje y revisiones</li>
        <li>Accidentes y valoraciones</li>
        <li>Compatible con bastidor europeo 17 dígitos</li>
      </ul>
      {vin && (
        <p className="text-caption text-mist-gray/50 mt-3">
          VIN: <strong className="text-pure-light font-mono text-xs">{vin}</strong>
        </p>
      )}
      <a
        href="https://www.carfax.eu/es"
        target="_blank"
        rel="noopener noreferrer"
        className="btn-ghost mt-5 inline-flex"
      >
        Ver en Carfax
      </a>
      <p className="text-[11px] text-mist-gray/30 mt-2">Se abre en carfax.eu</p>
    </div>
  );
}
