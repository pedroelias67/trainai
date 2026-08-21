export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { buildCalendarEvent, pushEvents } from "@/lib/intervals-icu";

/**
 * Pushes a training week's sessions to the athlete's Intervals.icu calendar,
 * from where they reach a Garmin, COROS, Suunto or Wahoo watch.
 */
export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const userId = cookieStore.get("user_id")?.value;
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const athlete = await prisma.athlete.findUnique({
    where: { userId },
    select: { id: true, intervalsIcuApiKey: true, intervalsIcuAthleteId: true },
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
          warmup: true, mainSet: true, cooldown: true,
        },
      },
    },
  });
  if (!week) return NextResponse.json({ error: "Semana não encontrada" }, { status: 404 });

  const events = week.sessions.map(buildCalendarEvent);
  const result = await pushEvents(athlete.intervalsIcuApiKey, athlete.intervalsIcuAthleteId, events);

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
  return NextResponse.json({ ok: true, pushed: result.count, weekNumber: week.weekNumber });
}
