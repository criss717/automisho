"use client";

import DGTGuideCard from "../dgt/DGTGuideCard";
import CarVerticalCard from "../dgt/CarVerticalCard";
import CarfaxCard from "../dgt/CarfaxCard";

export default function DgtHistoryCards() {
  return (
    <div className="grid gap-6 md:grid-cols-3 mt-8">
      <DGTGuideCard />
      <CarVerticalCard />
      <CarfaxCard />
    </div>
  );
}
