// Producing and sending an athlete's weekly report.
//
// Shared by the Sunday job and the admin's "send it now" button, because the
// same work written twice is how this project ended up storing the week's
// analysis in two different shapes.

import { differenceInWeeks } from "date-fns";
import { prisma } from "@/lib/prisma";
import { analyzeWeekAndAdapt } from "@/lib/claude";
import { sendWeeklyReportEmail } from "@/lib/email";

const weekForReport = {
  id: true, weekNumber: true, startDate: true, endDate: true, totalDistance: true,
  sessions: { select: { name: true, sport: true, sessionType: true, completed: true,
    plannedDistance: true, plannedDuration: true, plannedPace: true } },
  plan: {
    select: {
      totalWeeks: true, athleteId: true,
      event: { select: { name: true, date: true } },
      athlete: { select: { id: true, fitnessLevel: true, user: { select: { name: true, email: true } } } },
    },
  },
} as const;

/**
 * Writes the report for a week, asking the model to analyse it.
 *
 * Does nothing when one already exists: the analysis costs a model call, and
 * the stored one is what the athlete has already been told.
 */
export async function generateWeekReport(weekId: string): Promise<{ created: boolean }> {
  const existing = await prisma.weeklyReport.findUnique({ where: { weekId } });
  if (existing) return { created: false };

  const week = await prisma.trainingWeek.findUniqueOrThrow({ where: { id: weekId }, select: weekForReport });
  const athlete = week.plan.athlete;

  const activities = await prisma.activity.findMany({
    where: { athleteId: athlete.id, date: { gte: week.startDate, lte: week.endDate } },
  });

  const analysis = await analyzeWeekAndAdapt({
    athlete: { name: athlete.user.name ?? "Atleta", fitnessLevel: athlete.fitnessLevel },
    plannedSessions: week.sessions.map(s => ({
      name: s.name, sport: s.sport, sessionType: s.sessionType,
      plannedDistance: s.plannedDistance ?? undefined,
      plannedDuration: s.plannedDuration ?? undefined,
      plannedPace: s.plannedPace ?? undefined,
    })),
    completedActivities: activities.map(a => ({
      name: a.name ?? a.sport, sport: a.sport, date: a.date.toISOString(),
      distance: a.distance ? a.distance / 1000 : undefined,
      duration: a.duration ? a.duration / 60 : undefined,
      avgHR: a.avgHR ?? undefined, avgPace: a.avgPace ?? undefined,
      trainingLoad: a.trainingLoad ?? undefined,
    })),
    weekNumber: week.weekNumber,
    totalWeeks: week.plan.totalWeeks,
    eventName: week.plan.event.name,
    eventDate: week.plan.event.date.toISOString().split("T")[0],
  });

  await prisma.weeklyReport.create({
    data: {
      athleteId: athlete.id, weekId: week.id,
      weekStartDate: week.startDate, weekEndDate: week.endDate,
      plannedSessions: week.sessions.length,
      completedSessions: week.sessions.filter(s => s.completed).length,
      plannedDistance: week.totalDistance,
      actualDistance: activities.reduce((sum, a) => sum + (a.distance ?? 0) / 1000, 0),
      aiSummary: analysis.summary,
      nextWeekAdaptations: analysis.nextWeekAdjustments,
    },
  });
  await prisma.trainingWeek.update({
    where: { id: week.id },
    data: { aiAnalysis: JSON.stringify(analysis) },
  });

  return { created: true };
}

/**
 * Emails the stored report for a week. Throws when there is none: sending an
 * empty summary would be worse than saying nothing.
 */
export async function emailWeekReport(
  weekId: string,
  opts: { adaptationFailed?: boolean } = {}
): Promise<{ sentTo: string }> {
  const week = await prisma.trainingWeek.findUniqueOrThrow({ where: { id: weekId }, select: weekForReport });
  const report = await prisma.weeklyReport.findUnique({ where: { weekId } });
  if (!report?.aiSummary) throw new Error("Esta semana ainda não tem relatório para enviar");

  const athlete = week.plan.athlete;
  await sendWeeklyReportEmail(athlete.user.email, athlete.user.name ?? "Atleta", {
    weekNumber: week.weekNumber,
    completedSessions: report.completedSessions,
    plannedSessions: report.plannedSessions,
    actualDistance: report.actualDistance ?? 0,
    plannedDistance: report.plannedDistance,
    aiSummary: report.aiSummary,
    nextWeekAdaptations: report.nextWeekAdaptations,
    eventName: week.plan.event.name,
    weeksToEvent: Math.max(differenceInWeeks(week.plan.event.date, new Date()), 0),
    adaptationFailed: opts.adaptationFailed,
  });

  return { sentTo: athlete.user.email };
}

/**
 * The last week of training that has finished, across the athlete's plans —
 * the one a report would be about. Weeks still running are not reported on.
 */
export async function lastFinishedWeek(athleteId: string): Promise<{ id: string; weekNumber: number; endDate: Date } | null> {
  return prisma.trainingWeek.findFirst({
    where: { plan: { athleteId }, endDate: { lt: new Date() } },
    orderBy: { endDate: "desc" },
    select: { id: true, weekNumber: true, endDate: true },
  });
}
