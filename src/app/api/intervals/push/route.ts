export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildCalendarEvent,
  checkIntervalsConnection,
  formatThresholdPace,
  inferThresholdPace,
  replaceEvents,
} from "@/lib/intervals-icu";
import { getSessionUserId } from "@/lib/session";
import {
  checkWeekOnCalendar, recordIntervalsCheck, recordIntervalsPush, recordWeekOnCalendar,
  THRESHOLD_MISSING_WARNING,
} from "@/lib/intervals-connection";

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
    include: {
      sessions: {
        where: { cancelled: false },
        orderBy: { date: "asc" },
        select: {
          id: true, name: true, sport: true, sessionType: true, date: true,
          plannedDuration: true, plannedPace: true,
          warmup: true, mainSet: true, cooldown: true, steps: true,
        },
      },
    },
  });
  if (!week) return NextResponse.json({ error: "Semana não encontrada" }, { status: 404 });

  // One reference pace for the whole week, so the same zone means the same pace
  // on Tuesday as on Sunday.
  const threshold = inferThresholdPace(athlete.ltPace, week.sessions);
  const events = week.sessions.map(s => buildCalendarEvent(s, threshold));
  const result = await replaceEvents(athlete.intervalsIcuApiKey, athlete.intervalsIcuAthleteId, events);

  if (!result.ok) {
    await recordIntervalsPush(athlete.id, result.error);
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  await recordIntervalsPush(athlete.id, null);
  await recordWeekOnCalendar(athlete.id, await checkWeekOnCalendar(athlete));

  // The workouts are on the calendar, but Intervals.icu will strip their pace
  // targets on the way to the watch unless the athlete has a run threshold pace
  // over there. Worth saying out loud: nothing fails, the athlete just runs a
  // session that never tells them how fast to go.
  const check = await checkIntervalsConnection(athlete.intervalsIcuApiKey, athlete.intervalsIcuAthleteId);
  await recordIntervalsCheck(athlete.id, check);

  let warning: string | null = null;
  if (week.sessions.some(s => s.sport === "RUNNING") && check.status === "ok" && check.hasRunThreshold === false) {
    warning =
      THRESHOLD_MISSING_WARNING +
      (threshold ? `. Sugestão a partir do teu plano: ${formatThresholdPace(threshold)}` : "") +
      ".";
  }

  return NextResponse.json({ ok: true, pushed: result.count, weekNumber: week.weekNumber, warning });
}
