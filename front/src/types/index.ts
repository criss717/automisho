export type Plan = "free" | "premium" | "pro";

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
  fuel?: string | null;
  currency?: string;
  pros?: string[];
  cons?: string[];
}

