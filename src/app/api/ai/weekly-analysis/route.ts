export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { analyzeWeekAndAdapt } from "@/lib/claude";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const userId = cookieStore.get("user_id")?.value;
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    const { weekId } = await req.json();

    const athlete = await prisma.athlete.findUnique({
      where: { userId },
      include: { user: true },
    });
    if (!athlete) return NextResponse.json({ error: "Atleta não encontrado" }, { status: 404 });

    const week = await prisma.trainingWeek.findUnique({
      where: { id: weekId },
      include: {
        sessions: true,
        plan: { include: { event: true } },
      },
    });

    if (!week || week.plan.athleteId !== athlete.id) {
      return NextResponse.json({ error: "Semana não encontrada" }, { status: 404 });
    }

    // Atividades da semana
    const activities = await prisma.activity.findMany({
      where: {
        athleteId: athlete.id,
        date: { gte: week.startDate, lte: week.endDate },
      },
    });

    const analysis = await analyzeWeekAndAdapt({
      athlete: {
        name: athlete.user.name ?? "Atleta",
        fitnessLevel: athlete.fitnessLevel,
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
        date: a.date.toISOString(),
        distance: a.distance ? a.distance / 1000 : undefined,
        duration: a.duration ? a.duration / 60 : undefined,
        avgHR: a.avgHR ?? undefined,
        avgPace: a.avgPace ?? undefined,
        trainingLoad: a.trainingLoad ?? undefined,
      })),
      weekNumber: week.weekNumber,
      totalWeeks: week.plan.totalWeeks,
      eventName: week.plan.event.name,
      eventDate: week.plan.event.date.toISOString().split("T")[0],
    });

    // Guardar análise
    const updated = await prisma.trainingWeek.update({
      where: { id: weekId },
      data: {
        aiAnalysis: analysis.summary,
        adaptations: analysis.nextWeekAdjustments,
      },
    });

    // Criar relatório semanal
    await prisma.weeklyReport.upsert({
      where: { weekId },
      create: {
        athleteId: athlete.id,
        weekId,
        weekStartDate: week.startDate,
        weekEndDate: week.endDate,
        plannedSessions: week.sessions.length,
        completedSessions: week.sessions.filter((s) => s.completed).length,
        plannedDistance: week.totalDistance,
        actualDistance: activities.reduce((sum, a) => sum + (a.distance ?? 0) / 1000, 0),
        aiSummary: analysis.summary,
        nextWeekAdaptations: analysis.nextWeekAdjustments,
      },
      update: {
        aiSummary: analysis.summary,
        nextWeekAdaptations: analysis.nextWeekAdjustments,
        completedSessions: week.sessions.filter((s) => s.completed).length,
        actualDistance: activities.reduce((sum, a) => sum + (a.distance ?? 0) / 1000, 0),
      },
    });

    return NextResponse.json({ analysis, week: updated });
  } catch (err) {
    console.error("Weekly analysis error:", err);
    return NextResponse.json({ error: "Erro na análise semanal" }, { status: 500 });
  }
}
