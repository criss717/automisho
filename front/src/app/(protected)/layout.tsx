import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import AutoMishoCat from "@/components/icons/AutoMishoCat";

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
    <div className="h-screen flex flex-col bg-parchment text-charcoal overflow-hidden selection:bg-signal-blue/15">
      {/* Navbar de ancho completo */}
      <nav className="shrink-0 h-16 border-b border-mist bg-paper/90 backdrop-blur-md z-20 w-full">
        <div className="h-full w-full px-4 md:px-6 flex items-center justify-between">
          <Link href="/chat" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-full border border-mist bg-linen flex items-center justify-center group-hover:border-signal-blue transition-colors overflow-hidden">
              <AutoMishoCat size={24} interactive={false} />
            </div>
            <span className="font-ppmondwest text-graphite text-lg font-normal tracking-tight">AutoMisho</span>
            <span className="hidden sm:inline-block text-[10px] uppercase tracking-wider text-signal-blue font-medium px-2 py-0.5 rounded-full border border-signal-blue bg-linen">
              Copilot
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href="/chat"
              className="px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium text-charcoal hover:text-ink-black hover:bg-linen transition-all flex items-center gap-1.5"
            >
              <span>💬</span>
              <span>Copilot Chat</span>
            </Link>
            <Link
              href="/dashboard"
              className="px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium text-charcoal hover:text-ink-black hover:bg-linen transition-all flex items-center gap-1.5"
            >
              <span>⚙️</span>
              <span>Mi Cuenta</span>
            </Link>

            <div className="w-px h-5 bg-mist mx-2" />

            <span className="text-[11px] uppercase tracking-wider text-charcoal font-medium px-2.5 py-0.5 rounded-full bg-linen border border-mist hidden sm:inline-block">
              {userPlan === "free" && "Plan Gratis"}
              {userPlan === "premium" && "Plan Premium"}
              {userPlan === "pro" && "Plan Pro"}
            </span>

            <div
              title={session.user.email || "Usuario"}
              className="w-8 h-8 rounded-full bg-twilight text-white flex items-center justify-center text-xs font-semibold shadow-sm ml-1 cursor-default"
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
