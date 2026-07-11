export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { analyzeWeekAndAdapt } from "@/lib/claude";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const userId = cookieStore.get("user_id")?.value;
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { weekId } = await req.json();

  const athlete = await prisma.athlete.findUnique({
    where: { userId },
    include: { user: true },
  });
  if (!athlete) return NextResponse.json({ error: "Atleta não encontrado" }, { status: 404 });

  const week = await prisma.trainingWeek.findUnique({
    where: { id: weekId },
    include: {
      sessions: { orderBy: { date: "asc" } },
      plan: { include: { event: true } },
    },
  });

  if (!week || week.plan.athleteId !== athlete.id) {
    return NextResponse.json({ error: "Semana não encontrada" }, { status: 404 });
  }

  // Fetch completed activities for the week date range
  const activities = await prisma.activity.findMany({
    where: {
      athleteId: athlete.id,
      date: { gte: new Date(week.startDate), lte: new Date(week.endDate) },
    },
    orderBy: { date: "asc" },
  });

  const age = athlete.dateOfBirth
    ? Math.floor((Date.now() - new Date(athlete.dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
    : 30;

  const analysis = await analyzeWeekAndAdapt({
    athlete: {
      name: athlete.user.name ?? "Atleta",
      fitnessLevel: athlete.fitnessLevel ?? "INTERMEDIATE",
    },
    plannedSessions: week.sessions.map((s) => ({
      name: s.name,
      sport: s.sport,
      sessionType: s.sessionType,
      plannedDistance: s.plannedDistance ?? undefined,
      plannedDuration: s.plannedDuration ?? undefined,
      plannedPace: s.plannedPace ?? undefined,
    })),
    completedActivities: activities.map((a) => ({
      name: a.name ?? a.sport,
      sport: a.sport,
      date: a.date.toISOString().split("T")[0],
      distance: a.distance ? a.distance / 1000 : undefined,
      duration: a.duration ? Math.round(a.duration / 60) : undefined,
      avgHR: a.avgHR ?? undefined,
      avgPace: a.avgPace ?? undefined,
      trainingLoad: a.trainingLoad ?? undefined,
    })),
    weekNumber: week.weekNumber,
    totalWeeks: week.plan.totalWeeks,
    eventName: week.plan.event.name,
    eventDate: week.plan.event.date.toISOString().split("T")[0],
  });

  // Save analysis to the week
  await prisma.trainingWeek.update({
    where: { id: weekId },
    data: { aiAnalysis: JSON.stringify(analysis) },
  });

  return NextResponse.json(analysis);
}
