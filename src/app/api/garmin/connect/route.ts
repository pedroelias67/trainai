export const dynamic = "force-dynamic";
// The first sync reaches back a fortnight, which is two calls to Garmin.
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { obtainAccessToken } from "@/lib/garmin";
import { syncGarminDays } from "@/lib/garmin-sync";

/**
 * Stores the athlete's personal Garmin key, after proving it works.
 *
 * Proved rather than trusted: a key that is refused would otherwise sit there
 * looking connected and deliver nothing, which is exactly how a friend's Strava
 * spent four weeks pointing at the wrong account with a green tick beside it.
 */
export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const apiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";
  if (!apiKey) return NextResponse.json({ error: "Falta a chave" }, { status: 400 });

  const athlete = await prisma.athlete.findUnique({ where: { userId }, select: { id: true } });
  if (!athlete) return NextResponse.json({ error: "Atleta não encontrado" }, { status: 404 });

  const token = await obtainAccessToken(apiKey);
  if (!token.ok) return NextResponse.json({ error: token.error }, { status: 400 });

  await prisma.athlete.update({
    where: { id: athlete.id },
    data: { garminApiKey: apiKey, garminSyncError: null },
  });

  // Fetched at once, so the athlete sees what arrived instead of being told it
  // worked and waiting until Sunday to find out it did not.
  const sync = await syncGarminDays(athlete.id);

  return NextResponse.json({
    ok: true,
    ...(sync.status === "saved"
      ? {
          days: sync.days,
          withSleep: sync.withSleep,
          withHrv: sync.withHrv,
          message:
            sync.withSleep === 0 && sync.withHrv === 0
              ? "Ligado, mas o relógio não tem noites registadas nos últimos 14 dias."
              : `Ligado. ${sync.withSleep} noite(s) de sono e ${sync.withHrv} de HRV nos últimos 14 dias.`,
        }
      : { message: "Ligado, mas não consegui ler os dados agora. Tento outra vez no domingo." }),
  });
}

export async function DELETE() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const athlete = await prisma.athlete.findUnique({ where: { userId }, select: { id: true } });
  if (!athlete) return NextResponse.json({ error: "Atleta não encontrado" }, { status: 404 });

  // The measured days stay. They describe nights the athlete actually had, and
  // are no more a property of the key that fetched them than an imported
  // activity is of the Strava link that brought it in.
  await prisma.athlete.update({
    where: { id: athlete.id },
    data: { garminApiKey: null, garminSyncError: null, garminLastSyncAt: null },
  });

  return NextResponse.json({ ok: true });
}
