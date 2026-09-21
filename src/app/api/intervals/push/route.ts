export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkIntervalsConnection, formatThresholdPace } from "@/lib/intervals-icu";
import { sendWeekToWatch } from "@/lib/watch-sync";
import { getSessionUserId } from "@/lib/session";
import { recordIntervalsCheck, THRESHOLD_MISSING_WARNING } from "@/lib/intervals-connection";

/**
 * Pushes a training week's sessions to the athlete's Intervals.icu calendar,
 * from where they reach a Garmin, COROS, Suunto or Wahoo watch.
 */
export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const athlete = await prisma.athlete.findUnique({
    where: { userId },
    select: { id: true, intervalsIcuApiKey: true, intervalsIcuAthleteId: true, ltPace: true },
  });
  if (!athlete) return NextResponse.json({ error: "Atleta não encontrado" }, { status: 404 });

  if (!athlete.intervalsIcuApiKey || !athlete.intervalsIcuAthleteId) {
    return NextResponse.json({ error: "Intervals.icu não está ligado" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const weekId = typeof body?.weekId === "string" ? body.weekId : null;
  if (!weekId) return NextResponse.json({ error: "Semana em falta" }, { status: 400 });

  const week = await prisma.trainingWeek.findFirst({
    where: { id: weekId, plan: { athleteId: athlete.id } },
    select: { id: true, weekNumber: true },
  });
  if (!week) return NextResponse.json({ error: "Semana não encontrada" }, { status: 404 });

  const sent = await sendWeekToWatch(athlete.id, week.id);
  if (sent.status === "failed") return NextResponse.json({ error: sent.error }, { status: 502 });
  if (sent.status === "skipped") {
    return NextResponse.json(
      { error: sent.reason === "past-week" ? "Esta semana já passou" : "Nada para enviar nesta semana" },
      { status: 400 }
    );
  }

  // The workouts are on the calendar, but Intervals.icu will strip their pace
  // targets on the way to the watch unless the athlete has a run threshold pace
  // over there. Worth saying out loud: nothing fails, the athlete just runs a
  // session that never tells them how fast to go.
  const check = await checkIntervalsConnection(athlete.intervalsIcuApiKey, athlete.intervalsIcuAthleteId);
  await recordIntervalsCheck(athlete.id, check);

  let warning: string | null = null;
  if (sent.hasRunning && check.status === "ok" && check.hasRunThreshold === false) {
    warning =
      THRESHOLD_MISSING_WARNING +
      (sent.thresholdSecPerKm ? `. Sugestão a partir do teu plano: ${formatThresholdPace(sent.thresholdSecPerKm)}` : "") +
      ".";
  }

  return NextResponse.json({ ok: true, pushed: sent.count, weekNumber: week.weekNumber, warning });
}
