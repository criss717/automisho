import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"], weight: ["300", "400"], variable: "--font-inter" });

import AutoMishoCat from "@/components/icons/AutoMishoCat";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-parchment flex items-center justify-center p-4">
      <div className="relative z-10 w-full max-w-md">
        <a href="/" className="flex items-center justify-center gap-3 mb-8 text-decoration-none group">
          <div className="w-10 h-10 rounded-full bg-linen border border-mist flex items-center justify-center overflow-hidden group-hover:border-signal-blue transition-colors">
            <AutoMishoCat size={28} interactive={false} />
          </div>
          <span className="font-ppmondwest text-graphite text-2xl font-normal tracking-tight">AutoMisho</span>
        </a>
        {children}
      </div>
    </div>
  );
}
