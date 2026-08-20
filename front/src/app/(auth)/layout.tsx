import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"], weight: ["300", "400"], variable: "--font-inter" });

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-forest-depths flex items-center justify-center p-4">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-shadow-teal/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-midnight-tide/30 rounded-full blur-[100px]" />
      </div>
      <div className="relative z-10 w-full max-w-md">
        <a href="/" className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-full bg-mint-glow/10 border border-mint-glow/30 flex items-center justify-center">
            <img src="/assets/hero_logo.svg" alt="AutoMisho" className="w-7 h-7 object-contain" />
          </div>
          <span className="text-pure-light text-xl font-light">AutoMisho</span>
        </a>
        {children}
      </div>
    </div>
  );
}
