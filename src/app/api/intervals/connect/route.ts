export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkIntervalsConnection, verifyApiKey } from "@/lib/intervals-icu";
import { recordIntervalsCheck, THRESHOLD_MISSING_WARNING } from "@/lib/intervals-connection";
import { getSessionUserId } from "@/lib/session";

/** Stores an Intervals.icu API key after checking it actually works. */
export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const athlete = await prisma.athlete.findUnique({ where: { userId }, select: { id: true } });
  if (!athlete) return NextResponse.json({ error: "Atleta não encontrado" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const apiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";
  if (!apiKey) return NextResponse.json({ error: "Chave em falta" }, { status: 400 });

  const account = await verifyApiKey(apiKey);
  if (!account) {
    return NextResponse.json(
      { error: "Chave inválida. Confirma em intervals.icu → Settings → Developer Settings." },
      { status: 400 }
    );
  }

  await prisma.athlete.update({
    where: { id: athlete.id },
    data: {
      intervalsIcuApiKey: apiKey, intervalsIcuAthleteId: account.id,
      // A new key starts clean; whatever failed was about the old one.
      intervalsIcuPushError: null, intervalsIcuHasRunThreshold: null, intervalsIcuCheckedAt: null,
    },
  });

  // Checked now, while the athlete is on the page with Intervals.icu open in
  // another tab, rather than discovered mid-run when the watch shows no pace.
  const check = await checkIntervalsConnection(apiKey, account.id);
  await recordIntervalsCheck(athlete.id, check);
  const warning = check.status === "ok" && check.hasRunThreshold === false
    ? `${THRESHOLD_MISSING_WARNING}. Em intervals.icu → Settings → Corrida → Definições de Ritmo, preenche o "Ritmo de limiar".`
    : null;

  return NextResponse.json({ ok: true, athleteName: account.name, warning });
}

/** Forgets the key, leaving anything already on the Intervals.icu calendar in place. */
export async function DELETE() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  await prisma.athlete.update({
    where: { userId },
    data: {
      intervalsIcuApiKey: null, intervalsIcuAthleteId: null,
      intervalsIcuPushError: null, intervalsIcuHasRunThreshold: null, intervalsIcuCheckedAt: null,
    },
  });

  return NextResponse.json({ ok: true });
}
