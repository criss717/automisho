import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Simple in-memory rate limit for middleware (edge-compatible, per-instance)
const RATE_LIMIT_ENABLED = process.env.RATE_LIMIT_ENABLED !== "false";
const store = new Map<string, { count: number; reset: number }>();

function isRateLimited(req: NextRequest): boolean {
  if (!RATE_LIMIT_ENABLED) return false;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  const key = `${ip}:${req.nextUrl.pathname}`;
  const now = Date.now();
  const windowMs = 60_000;
  const limit = 10;

  const entry = store.get(key);
  if (!entry || now > entry.reset) {
    store.set(key, { count: 1, reset: now + windowMs });
    return false;
  }
  if (entry.count >= limit) return true;
  entry.count += 1;
  return false;
}

const rateLimitedPaths = ["/api/chat", "/api/dgt", "/api/search", "/api/register", "/api/checkout", "/api/scrape"];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Rate limit check for API routes
  if (rateLimitedPaths.some((p) => pathname.startsWith(p))) {
    if (isRateLimited(req as unknown as NextRequest)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": "60" } });
    }
  }

  const isLoggedIn = !!req.auth;
  const isProtected = pathname.startsWith("/chat") || pathname.startsWith("/dashboard");

  if (isProtected && !isLoggedIn) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Add security headers via middleware as well (complement next.config headers)
  const response = NextResponse.next();
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Frame-Options", "DENY");
  return response;
});

export const config = {
  matcher: ["/chat/:path*", "/dashboard/:path*", "/api/chat/:path*", "/api/dgt/:path*", "/api/search/:path*", "/api/register/:path*", "/api/checkout/:path*"],
};
