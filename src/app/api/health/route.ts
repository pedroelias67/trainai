export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

async function checkDatabase(): Promise<{ ok: boolean; latencyMs: number }> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, latencyMs: Date.now() - start };
  } catch {
    return { ok: false, latencyMs: Date.now() - start };
  }
}

async function checkClaude(): Promise<{ ok: boolean }> {
  try {
    if (!process.env.ANTHROPIC_API_KEY) return { ok: false };
    return { ok: true }; // key present; full ping would cost tokens
  } catch {
    return { ok: false };
  }
}

export async function GET() {
  const [db, claude] = await Promise.all([checkDatabase(), checkClaude()]);

  const allOk = db.ok && claude.ok;

  return NextResponse.json(
    {
      status: allOk ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      services: {
        database: { status: db.ok ? "ok" : "error", latencyMs: db.latencyMs },
        ai: { status: claude.ok ? "ok" : "error" },
        email: { status: process.env.RESEND_API_KEY ? "ok" : "unconfigured" },
        push: { status: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ? "ok" : "unconfigured" },
      },
    },
    { status: allOk ? 200 : 503 }
  );
}
