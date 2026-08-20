type Entry = { count: number; reset: number };

const store = new Map<string, Entry>();

export const RATE_LIMIT_ENABLED = process.env.RATE_LIMIT_ENABLED !== "false";

function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "127.0.0.1";
}

/**
 * Rate limit check: 10/min free, 20/min premium/pro
 * Returns true if allowed, false if rate limited
 */
export function checkRateLimit(req: Request, plan?: string): boolean {
  if (!RATE_LIMIT_ENABLED) return true;

  const ip = getClientIp(req);
  // If authenticated, include user id for more precise key; we try to get from header x-user-id if set
  const userHint = req.headers.get("x-user-id") || "";
  const key = userHint ? `${ip}:${userHint}` : ip;
  const limit = plan === "premium" || plan === "pro" ? 20 : 10;
  const windowMs = 60_000;
  const now = Date.now();

  const entry = store.get(key);
  if (!entry || now > entry.reset) {
    store.set(key, { count: 1, reset: now + windowMs });
    return true;
  }

  if (entry.count >= limit) {
    return false;
  }

  entry.count += 1;
  return true;
}

export function rateLimitResponse() {
  return Response.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": "60" } });
}

// Cleanup expired entries every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of store.entries()) {
      if (now > v.reset) store.delete(k);
    }
  }, 5 * 60 * 1000);
  // Allow Node to exit even if timer pending
  // @ts-ignore
  if (typeof global !== "undefined" && global && (global as unknown as { unref?: unknown }).unref) {
  }
}
