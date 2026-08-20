export type Plan = "free" | "premium" | "pro";

export interface CarResult {
  title: string;
  price: string;
  year: string;
  km: string;
  location: string;
  score: number;
  alerts: number;
  source: string;
}
