"use client";

interface Props {
  vin?: string;
  plate?: string;
}

export default function CarVerticalCard({ vin }: Props) {
  return (
    <div className="glass-card">
      <span className="tag">CarVertical — ~15 €</span>
      <h3 className="text-heading-sm text-pure-light font-teodor mt-3">Historial por VIN</h3>
      <p className="text-caption text-mist-gray/70 mt-1">Ideal si tienes el número de bastidor (17 caracteres).</p>
      <ul className="list-disc ml-4 mt-4 text-sm text-mist-gray space-y-1">
        <li>Kilometraje real y posibles manipulaciones</li>
        <li>Accidentes y daños registrados</li>
        <li>Robos, taxi/VTC, historial de propietarios</li>
        <li>Fotos históricas si existen</li>
      </ul>
      {vin && (
        <p className="text-caption text-mist-gray/50 mt-3">
          VIN: <strong className="text-pure-light font-mono text-xs">{vin}</strong>
        </p>
      )}
      <a
        href="https://www.carvertical.com/es"
        target="_blank"
        rel="noopener noreferrer"
        className="btn-ghost mt-5 inline-flex"
      >
        Ver en CarVertical
      </a>
      <p className="text-[11px] text-mist-gray/30 mt-2">Se abre en carvertical.com</p>
    </div>
  );
}
