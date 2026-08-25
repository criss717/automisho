import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const userInitial = session.user.name?.[0]?.toUpperCase() || session.user.email?.[0]?.toUpperCase() || "U";
  const userPlan = session.user.plan || "free";

  return (
    <div className="h-screen flex flex-col bg-forest-depths overflow-hidden">
      {/* Navbar */}
      <nav className="shrink-0 h-16 border-b border-midnight-tide bg-forest-depths/95 backdrop-blur-xl z-20">
        <div className="h-full max-w-7xl mx-auto px-4 md:px-6 flex items-center justify-between">
          <Link href="/chat" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-full bg-mint-glow/10 border border-mint-glow/30 flex items-center justify-center group-hover:bg-mint-glow/20 group-hover:shadow-[0_0_12px_rgba(151,252,215,0.4)] transition-all">
              <img src="/assets/hero_logo.svg" alt="AutoMisho" className="w-5 h-5 object-contain" />
            </div>
            <span className="text-pure-light text-base font-medium tracking-wide">AutoMisho</span>
            <span className="hidden sm:inline-block text-[10px] uppercase tracking-wider text-mint-glow font-medium px-2 py-0.5 rounded-full border border-mint-glow/30 bg-mint-glow/10">
              Copilot
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href="/chat"
              className="px-3.5 py-1.5 rounded-full text-xs md:text-sm text-mist-gray hover:text-pure-light hover:bg-white/5 transition-all flex items-center gap-1.5"
            >
              <span>💬</span>
              <span>Copilot Chat</span>
            </Link>
            <Link
              href="/dashboard"
              className="px-3.5 py-1.5 rounded-full text-xs md:text-sm text-mist-gray hover:text-pure-light hover:bg-white/5 transition-all flex items-center gap-1.5"
            >
              <span>⚙️</span>
              <span>Mi Cuenta</span>
            </Link>

            <div className="w-px h-5 bg-midnight-tide mx-2" />

            <span className="text-[11px] uppercase tracking-wider text-mint-glow/80 font-medium px-2.5 py-1 rounded-full bg-midnight-tide border border-shadow-teal hidden sm:inline-block">
              {userPlan === "free" && "Plan Gratis"}
              {userPlan === "premium" && "Plan Premium"}
              {userPlan === "pro" && "Plan Pro"}
            </span>

            <div
              title={session.user.email || "Usuario"}
              className="w-8 h-8 rounded-full bg-midnight-tide border border-shadow-teal flex items-center justify-center text-mint-glow text-xs font-semibold shadow-sm ml-1 cursor-default"
            >
              {userInitial}
            </div>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 min-h-0 overflow-hidden">{children}</main>
    </div>
  );
}
