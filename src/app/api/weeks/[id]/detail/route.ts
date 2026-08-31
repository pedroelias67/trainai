export const dynamic = "force-dynamic";
// Detailing a week is roughly 7s per session, so well under a minute.
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { detailSessions } from "@/lib/claude";

/**
 * Writes the coaching prose for a week's sessions. The plan is created as a
 * skeleton so it appears in seconds; this fills in the parts that take minutes.
 *
 * Idempotent: only sessions still missing a main set are sent to the model, so
 * a retry after a partial failure completes what is left rather than redoing it.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const userId = cookieStore.get("user_id")?.value;
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const athlete = await prisma.athlete.findUnique({ where: { userId } });
  if (!athlete) return NextResponse.json({ error: "Atleta não encontrado" }, { status: 404 });

  const { id } = await params;
  const week = await prisma.trainingWeek.findFirst({
    where: { id, plan: { athleteId: athlete.id } },
    include: {
      plan: { include: { event: true } },
      sessions: { where: { mainSet: null, cancelled: false }, orderBy: { date: "asc" } },
    },
  });
  if (!week) return NextResponse.json({ error: "Semana não encontrada" }, { status: 404 });
  if (week.sessions.length === 0) return NextResponse.json({ ok: true, detailed: 0 });

  const details = await detailSessions({
    athlete: {
      name: "Atleta",
      age: 30,
      gender: athlete.gender ?? "MALE",
      fitnessLevel: athlete.fitnessLevel,
      weeklyHours: athlete.weeklyHours ?? 8,
      maxHR: athlete.maxHR ?? undefined,
      ltPace: athlete.ltPace ?? undefined,
    },
    event: {
      name: week.plan.event.name,
      sport: week.plan.event.sport,
      distance: week.plan.event.distance,
      date: week.plan.event.date.toISOString().split("T")[0],
      goalType: week.plan.event.goalType,
      goalTime: week.plan.event.goalTime ?? undefined,
    },
    weekFocus: week.focus,
    sessions: week.sessions.map(s => ({
      id: s.id, name: s.name, sport: s.sport, sessionType: s.sessionType,
      dayOfWeek: s.dayOfWeek, plannedDistance: s.plannedDistance,
      plannedDuration: s.plannedDuration, plannedPace: s.plannedPace,
    })),
  });

  const permitidos = new Set(week.sessions.map(s => s.id));
  let detailed = 0;
  for (const d of details) {
    // The model echoes the ids back; ignore anything that is not one we sent.
    if (!permitidos.has(d.id)) continue;
    await prisma.trainingSession.update({
      where: { id: d.id },
      data: {
        shortDescription: d.shortDescription ?? null,
        warmup: d.warmup ?? null,
        mainSet: d.mainSet ?? null,
        cooldown: d.cooldown ?? null,
        coachTip: d.coachTip ?? null,
        rpe: d.rpe ?? null,
        keyFocus: d.keyFocus ?? null,
        ...(d.zones ? { plannedZones: d.zones } : {}),
      },
    });
    detailed++;
  }

  return NextResponse.json({ ok: true, detailed, remaining: week.sessions.length - detailed });
}
