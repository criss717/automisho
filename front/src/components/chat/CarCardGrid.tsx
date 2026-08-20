"use client";

import CarResultCard from "./CarResultCard";
import type { CarResult } from "@/types";

interface CarCardGridProps {
  cars: CarResult[];
}

export default function CarCardGrid({ cars }: CarCardGridProps) {
  if (!cars || cars.length === 0) return null;
  return (
    <div className="grid gap-3">
      {cars.map((car) => (
        <CarResultCard key={car.url || car.title} car={car} />
      ))}
    </div>
  );
}
