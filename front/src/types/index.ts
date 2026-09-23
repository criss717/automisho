export type Plan = "free" | "premium" | "pro";

export interface FlipOpportunity {
  flipPotential?: "Alto" | "Medio" | "Bajo" | null;
  damageSummary?: string | null;
  estimatedRepairCost?: string | null;
}

export interface VisualAudit {
  doorsDetected?: number | null;
  bodyCondition?: string;
  verified3p?: boolean;
  colorDetected?: string | null;
  bodyTypeDetected?: string | null;
  userCriteriaMatch?: boolean | null;
  criteriaNotes?: string | null;
  rejectionReason?: string | null;
  flipOpportunity?: FlipOpportunity | null;
}

export interface CarResult {
  title: string;
  price: number | string;
  year?: number | string | null;
  km?: number | string | null;
  location?: string | null;
  score?: number | null;
  alerts?: number | null;
  source: string;
  url?: string;
  image_url?: string | null;
  images?: string[];
  fuel?: string | null;
  currency?: string;
  doors?: number | null;
  description?: string | null;
  pros?: string[];
  cons?: string[];
  visualAudit?: VisualAudit | null;
}

