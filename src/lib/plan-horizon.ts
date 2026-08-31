import { prisma } from "@/lib/prisma";
import { extendPlanSkeleton } from "@/lib/claude";

/**
 * Plans are kept on a rolling horizon: this many weeks are materialised ahead of
 * the athlete's current week, and the rest are added as they advance.
 *
 * Generating a whole marathon block up front would put minutes on the onboarding
 * of exactly the people who plan furthest ahead, and the late weeks would be
 * rewritten by the weekly adaptation long before they arrived anyway.
 */
export const HORIZON_WEEKS = 8;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Adds whatever weeks are missing from the horizon, up to `maxWeeks` per call.
 * Returns the week numbers created — empty when the plan is already covered,
 * which is the normal case on most days.
 */
export async function topUpPlanHorizon(planId: string, maxWeeks = 2): Promise<number[]> {
  const plan = await prisma.trainingPlan.findUnique({
    where: { id: planId },
    include: {
      event: true,
      athlete: { include: { user: true } },
      weeks: { orderBy: { weekNumber: "asc" }, select: { weekNumber: true, focus: true, totalDistance: true } },
    },
  });
  if (!plan || plan.status !== "ACTIVE") return [];

  const ultima = plan.weeks.length > 0 ? plan.weeks[plan.weeks.length - 1].weekNumber : 0;
  // How far ahead the plan should already reach, never past the event.
  const alvo = Math.min(plan.currentWeek + HORIZON_WEEKS - 1, plan.totalWeeks);
  if (ultima >= alvo) return [];

  const fromWeek = ultima + 1;
  const toWeek = Math.min(fromWeek + maxWeeks - 1, alvo);

  const json = await extendPlanSkeleton({
    athlete: {
      name: plan.athlete.user.name ?? "Atleta",
      age: plan.athlete.dateOfBirth
        ? new Date().getFullYear() - plan.athlete.dateOfBirth.getFullYear()
        : 30,
      gender: plan.athlete.gender ?? "MALE",
      fitnessLevel: plan.athlete.fitnessLevel,
      weeklyHours: plan.athlete.weeklyHours ?? 8,
      trainingDaysPerWeek: plan.athlete.trainingDaysPerWeek ?? undefined,
      longRunDay: plan.athlete.longRunDay ?? undefined,
      preferredDays: plan.athlete.preferredDays.length > 0 ? plan.athlete.preferredDays : undefined,
      maxHR: plan.athlete.maxHR ?? undefined,
      ltPace: plan.athlete.ltPace ?? undefined,
    },
    event: {
      name: plan.event.name,
      sport: plan.event.sport,
      distance: plan.event.distance,
      date: plan.event.date.toISOString().split("T")[0],
      goalType: plan.event.goalType,
      goalTime: plan.event.goalTime ?? undefined,
    },
    totalWeeks: plan.totalWeeks,
    fromWeek,
    toWeek,
    // Only the recent past: enough for the model to continue the progression
    // without spending the prompt on weeks long since trained.
    previousWeeks: plan.weeks.slice(-6).map(w => ({
      weekNumber: w.weekNumber,
      focus: w.focus,
      totalDistanceKm: w.totalDistance,
    })),
  });

  const dados = JSON.parse(json);
  const criadas: number[] = [];

  for (const week of dados.weeks ?? []) {
    const numero = Number(week.weekNumber);
    // The model occasionally renumbers; only accept what was asked for, and
    // never overwrite a week that already exists.
    if (!Number.isInteger(numero) || numero < fromWeek || numero > toWeek) continue;
    if (plan.weeks.some(w => w.weekNumber === numero)) continue;

    const weekStart = new Date(plan.startDate.getTime() + (numero - 1) * 7 * DAY_MS);
    const weekEnd = new Date(weekStart.getTime() + 6 * DAY_MS);
    weekEnd.setHours(23, 59, 59, 999);

    await prisma.trainingWeek.create({
      data: {
        planId: plan.id,
        weekNumber: numero,
        startDate: weekStart,
        endDate: weekEnd,
        focus: week.focus ?? null,
        coachMessage: week.coachMessage ?? null,
        totalDistance: week.totalDistanceKm ?? null,
        totalDuration: week.totalDurationMin ?? null,
        sessions: {
          create: (week.sessions ?? []).map((s: any) => {
            const sessionDate = new Date(weekStart.getTime());
            sessionDate.setDate(sessionDate.getDate() + (Number(s.dayOfWeek) - 1));
            return {
              dayOfWeek: Number(s.dayOfWeek),
              date: sessionDate,
              sport: s.sport,
              sessionType: s.sessionType,
              name: s.name,
              plannedDistance: s.plannedDistanceKm ?? null,
              plannedDuration: s.plannedDurationMin ?? null,
              plannedPace: s.plannedPace ?? null,
              isPriority: s.isPriority ?? (s.sessionType === "LONG" || s.sessionType === "BRICK"),
            };
          }),
        },
      },
    });
    criadas.push(numero);
  }

  return criadas;
}
