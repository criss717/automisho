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

  return (
    <div className="h-screen flex flex-col bg-forest-depths overflow-hidden">
      {/* Navbar */}
      <nav className="shrink-0 h-16 border-b border-midnight-tide bg-forest-depths/95 backdrop-blur-xl">
        <div className="h-full max-w-6xl mx-auto px-6 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-full bg-mint-glow/10 border border-mint-glow/30 flex items-center justify-center group-hover:bg-mint-glow/20 transition-colors">
              <img src="/assets/hero_logo.svg" alt="" className="w-5 h-5 object-contain" />
            </div>
            <span className="text-pure-light text-base font-medium">AutoMisho</span>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href="/chat"
              className="px-4 py-2 rounded-lg text-sm text-mist-gray hover:text-pure-light hover:bg-white/5 transition-all"
            >
              Chat
            </Link>
            <Link
              href="/dashboard"
              className="px-4 py-2 rounded-lg text-sm text-mist-gray hover:text-pure-light hover:bg-white/5 transition-all"
            >
              Dashboard
            </Link>

            <div className="w-px h-6 bg-midnight-tide mx-3" />

            <span className="text-xs uppercase tracking-wider text-mint-glow/70 font-medium mr-3">
              {session.user.plan === "free" && "Gratis"}
              {session.user.plan === "premium" && "Premium"}
              {session.user.plan === "pro" && "Pro"}
            </span>

            <div className="w-8 h-8 rounded-full bg-midnight-tide border border-shadow-teal flex items-center justify-center text-mint-glow text-sm font-medium">
              {session.user.name?.[0]?.toUpperCase() || session.user.email?.[0]?.toUpperCase() || "U"}
            </div>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 min-h-0">{children}</main>
    </div>
  );
}
