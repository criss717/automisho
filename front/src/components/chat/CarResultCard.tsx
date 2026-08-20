"use client";

import { motion } from "framer-motion";
import type { CarResult } from "@/types";

export default function CarResultCard({ car }: { car: CarResult }) {
  return (
    <div className="bg-forest-depths border border-midnight-tide rounded-xl p-4 max-w-[320px]">
      <div className="flex justify-between items-start mb-2">
        <h4 className="text-body-sm text-pure-light font-medium">{car.title}</h4>
        <span className="text-[10px] border border-mint-glow text-mint-glow rounded-full px-2 py-0.5">
          {car.source}
        </span>
      </div>

      <div className="flex items-center gap-4 mb-3">
        <span className="text-[28px] text-mint-glow font-teodor">{car.price}</span>
        <div className="flex items-center gap-2 text-mist-gray text-caption">
          <span>{car.year}</span>
          <span>·</span>
          <span>{car.km}</span>
          <span>·</span>
          <span>{car.location}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-midnight-tide rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${car.score}%` }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="h-full rounded-full"
            style={{
              background: "linear-gradient(to right, #33998c, #97fcd7)",
            }}
          />
        </div>
        <span className="text-caption text-mint-glow">{car.score}/100</span>
      </div>

      {car.alerts === 0 && (
        <p className="text-caption text-mint-glow mt-2 flex items-center gap-1">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M3 6 L5 8 L9 4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Sin alertas rojas detectadas
        </p>
      )}

      {car.alerts > 0 && (
        <p className="text-caption text-amber-400 mt-2 flex items-center gap-1">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M6 3v4M6 9v.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          {car.alerts} alerta{car.alerts > 1 ? "s" : ""} detectada{car.alerts > 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
