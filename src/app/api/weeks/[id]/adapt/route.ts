export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { suggestSessionAdaptations } from "@/lib/claude";
import { startOfDay, subDays } from "date-fns";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  const userId = cookieStore.get("user_id")?.value;
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const athlete = await prisma.athlete.findUnique({ where: { userId } });
  if (!athlete) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const { id } = await params;

  // This is the NEXT week to adapt
  const week = await prisma.trainingWeek.findFirst({
    where: { id, plan: { athleteId: athlete.id } },
    include: {
      sessions: { where: { cancelled: false, completed: false }, orderBy: { date: "asc" } },
    },
  });
  if (!week) return NextResponse.json({ error: "Semana não encontrada" }, { status: 404 });

  if (week.adaptationsApplied) {
    return NextResponse.json({ message: "Adaptações já aplicadas nesta semana" });
  }

  // Get the previous week's report for context
  const prevWeek = await prisma.trainingWeek.findFirst({
    where: { planId: week.planId, weekNumber: week.weekNumber - 1 },
    include: { weeklyReport: true },
  });

  if (!prevWeek?.weeklyReport?.aiSummary) {
    return NextResponse.json({ error: "Sem relatório da semana anterior para basear as adaptações" }, { status: 400 });
  }

  // Get wellness logs from the past 7 days
  const wellnessLogs = await prisma.wellnessLog.findMany({
    where: {
      athleteId: athlete.id,
      date: { gte: subDays(startOfDay(new Date()), 7) },
    },
    orderBy: { date: "desc" },
  });

  const wellnessSummary = wellnessLogs.length > 0
    ? wellnessLogs.map(l =>
        `${l.date.toISOString().split("T")[0]}: sono=${l.sleepQuality ?? "?"}/5 fadiga=${l.fatigue ?? "?"}/5 humor=${l.mood ?? "?"}/5 músculos=${l.musclesSore ?? "?"}/5 RPE=${l.rpe ?? "?"}/10${l.notes ? ` notas: ${l.notes}` : ""}`
      ).join("\n")
    : "Sem dados de bem-estar registados";

  const adjustments = await suggestSessionAdaptations({
    analysis: prevWeek.weeklyReport.aiSummary,
    nextWeekAdjustments: prevWeek.weeklyReport.nextWeekAdaptations ?? "",
    wellnessSummary,
    sessions: week.sessions.map(s => ({
      id: s.id,
      name: s.name,
      sessionType: s.sessionType,
      plannedDistance: s.plannedDistance,
      plannedDuration: s.plannedDuration,
      plannedPace: s.plannedPace,
    })),
  });

  // Apply adjustments to sessions
  let appliedCount = 0;
  for (const adj of adjustments) {
    const session = week.sessions.find(s => s.id === adj.sessionId);
    if (!session || adj.action === "keep") continue;

    const update: Record<string, unknown> = {};

    if (adj.action === "convert_to_easy" || adj.convertToType) {
      update.sessionType = adj.convertToType ?? "EASY";
      update.name = `[Adaptado] ${session.name}`;
      update.coachTip = adj.reason;
    }

    if (adj.distanceMultiplier && session.plannedDistance) {
      update.plannedDistance = Math.round(session.plannedDistance * adj.distanceMultiplier * 10) / 10;
    }
    if (adj.durationMultiplier && session.plannedDuration) {
      update.plannedDuration = Math.round(session.plannedDuration * adj.durationMultiplier);
    }
    if (adj.newPace) {
      update.plannedPace = adj.newPace;
    }
    if (adj.action === "reduce_intensity") {
      update.coachTip = adj.reason;
    }

    if (Object.keys(update).length > 0) {
      await prisma.trainingSession.update({ where: { id: adj.sessionId }, data: update });
      appliedCount++;
    }
  }

  // Mark week as adapted and save adaptations text
  const adaptationSummary = adjustments
    .filter(a => a.action !== "keep")
    .map(a => {
      const s = week.sessions.find(x => x.id === a.sessionId);
      return `• ${s?.name ?? a.sessionId}: ${a.reason}`;
    })
    .join("\n");

  await prisma.trainingWeek.update({
    where: { id: week.id },
    data: {
      adaptationsApplied: true,
      adaptations: adaptationSummary || "Nenhum ajuste necessário — mantém o plano.",
    },
  });

  return NextResponse.json({ applied: appliedCount, adjustments });
}
