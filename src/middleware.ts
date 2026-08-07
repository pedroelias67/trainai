import { NextRequest, NextResponse } from "next/server";

// In-memory rate limit store (resets on cold start — acceptable for Vercel Edge)
const store = new Map<string, { count: number; resetAt: number }>();

const LIMITS: Record<string, { max: number; windowMs: number }> = {
  "/api/auth/login":         { max: 10,  windowMs: 60_000 },       // 10/min
  "/api/auth/register":      { max: 5,   windowMs: 60_000 },       // 5/min
  "/api/auth/forgot-password": { max: 3, windowMs: 300_000 },      // 3/5min
  "/api/ai":                 { max: 20,  windowMs: 60_000 },       // 20/min (AI routes)
  "/api/training-plans":     { max: 5,   windowMs: 300_000 },      // 5/5min (plan generation)
};

function getLimit(pathname: string) {
  // Exact match first, then prefix match
  if (LIMITS[pathname]) return LIMITS[pathname];
  for (const [prefix, limit] of Object.entries(LIMITS)) {
    if (pathname.startsWith(prefix)) return limit;
  }
  return { max: 100, windowMs: 60_000 }; // default: 100/min per IP for all API routes
}

function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only rate-limit API routes
  if (!pathname.startsWith("/api/")) return NextResponse.next();

  // Skip cron routes (protected by CRON_SECRET)
  if (pathname.startsWith("/api/cron/")) return NextResponse.next();

  const ip = getIp(req);
  const key = `${ip}:${pathname}`;
  const { max, windowMs } = getLimit(pathname);
  const now = Date.now();

  const entry = store.get(key);
  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return NextResponse.next();
  }

  entry.count++;
  if (entry.count > max) {
    return new NextResponse(
      JSON.stringify({ error: "Demasiados pedidos. Tenta novamente em breve." }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(Math.ceil((entry.resetAt - now) / 1000)),
          "X-RateLimit-Limit": String(max),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(entry.resetAt),
        },
      }
    );
  }

  const res = NextResponse.next();
  res.headers.set("X-RateLimit-Limit", String(max));
  res.headers.set("X-RateLimit-Remaining", String(max - entry.count));
  return res;
}

export const config = {
  matcher: "/api/:path*",
};
