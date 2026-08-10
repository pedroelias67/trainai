export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateTrainingPlan } from "@/lib/claude";
import { cookies } from "next/headers";
import { differenceInWeeks, addDays } from "date-fns";

const sessionTypeMap: Record<string, string> = {
  LONG_RUN: "LONG", LONG_RIDE: "LONG", LONG_SWIM: "LONG",
  INTERVAL: "INTERVALS", SPEED: "INTERVALS", FARTLEK: "INTERVALS",
  THRESHOLD: "TEMPO", AEROBIC: "EASY", BASE: "EASY",
};
const sportMap: Record<string, string> = {
  RUN: "RUNNING", BIKE: "CYCLING", CYCLE: "CYCLING", SWIM: "SWIMMING",
};
const sessionPriority: Record<string, number> = {
  LONG: 6, INTERVALS: 5, TEMPO: 4, STRENGTH: 3, BRICK: 3, SWIM: 3, EASY: 2, RECOVERY: 1, RACE: 7,
};

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get("user_id")?.value;
    if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const athlete = await prisma.athlete.findUnique({
      where: { userId },
      include: {
        user: true,
        trainingPlans: {
          where: { status: "ACTIVE" },
          include: {
            event: true,
            weeks: { orderBy: { weekNumber: "asc" } },
          },
          take: 1,
        },
      },
    });

    if (!athlete) return NextResponse.json({ error: "Atleta não encontrado" }, { status: 404 });

    const plan = athlete.trainingPlans[0];
    if (!plan) return NextResponse.json({ error: "Sem plano ativo" }, { status: 404 });

    const existingWeekNumbers = new Set(plan.weeks.map(w => w.weekNumber));
    const missingWeeks: number[] = [];
    for (let i = 1; i <= plan.totalWeeks; i++) {
      if (!existingWeekNumbers.has(i)) missingWeeks.push(i);
    }

    if (missingWeeks.length === 0) {
      return NextResponse.json({ message: "Plano já tem todas as semanas", added: 0 });
    }

    const today = new Date();
    const age = athlete.dateOfBirth
      ? new Date().getFullYear() - new Date(athlete.dateOfBirth).getFullYear()
      : 30;

    // Generate full plan and extract only missing weeks
    const planJson = await generateTrainingPlan({
      athlete: {
        name: athlete.user.name ?? "Atleta",
        age,
        gender: athlete.gender ?? "MALE",
        fitnessLevel: athlete.fitnessLevel,
        weeklyHours: athlete.weeklyHours ?? 8,
        trainingDaysPerWeek: athlete.trainingDaysPerWeek ?? undefined,
        longRunDay: athlete.longRunDay ?? undefined,
        restingHR: athlete.restingHR ?? undefined,
        maxHR: athlete.maxHR ?? undefined,
        ltPace: athlete.ltPace ?? undefined,
        ftp: athlete.ftp ?? undefined,
      },
      event: {
        name: plan.event.name,
        sport: plan.event.sport,
        distance: plan.event.distance,
        date: plan.event.date.toISOString().split("T")[0],
        goalType: plan.event.goalType,
        goalTime: plan.event.goalTime ?? undefined,
      },
      currentDate: today.toISOString().split("T")[0],
      weeksUntilEvent: differenceInWeeks(plan.event.date, today),
    });

    const planData = JSON.parse(planJson);
    const planStart = new Date(plan.startDate);

    let added = 0;

    for (const week of planData.weeks) {
      if (!missingWeeks.includes(week.weekNumber)) continue;

      const weekStart = addDays(planStart, (week.weekNumber - 1) * 7);
      const weekEnd = addDays(weekStart, 6);
      weekEnd.setHours(23, 59, 59, 999);

      // Enforce max sessions per week
      const maxDays = athlete.trainingDaysPerWeek ?? null;
      let sessions = week.sessions;
      if (maxDays && sessions.length > maxDays) {
        sessions.sort((a: any, b: any) =>
          (sessionPriority[b.sessionType] ?? 0) - (sessionPriority[a.sessionType] ?? 0)
        );
        sessions = sessions.slice(0, maxDays);
        sessions.sort((a: any, b: any) => a.dayOfWeek - b.dayOfWeek);
      }

      await prisma.trainingWeek.create({
        data: {
          planId: plan.id,
          weekNumber: week.weekNumber,
          startDate: weekStart,
          endDate: weekEnd,
          focus: week.focus,
          coachMessage: week.coachMessage,
          totalDistance: week.totalDistanceKm,
          totalDuration: week.totalDurationMin,
          sessions: {
            create: sessions.map((session: any) => {
              const sessionDate = addDays(weekStart, session.dayOfWeek - 1);
              return {
                dayOfWeek: session.dayOfWeek,
                date: sessionDate,
                sport: sportMap[session.sport] ?? session.sport,
                sessionType: sessionTypeMap[session.sessionType] ?? session.sessionType,
                name: session.name,
                shortDescription: session.shortDescription,
                warmup: session.warmup,
                mainSet: session.mainSet,
                cooldown: session.cooldown,
                coachTip: session.coachTip,
                rpe: session.rpe,
                keyFocus: session.keyFocus,
                plannedDistance: session.plannedDistanceKm,
                plannedDuration: session.plannedDurationMin,
                plannedPace: session.plannedPace,
                plannedZones: session.zones,
                isPriority: session.isPriority ?? (
                  session.sessionType === "LONG" || session.sessionType === "BRICK"
                ),
              };
            }),
          },
        },
      });

      added++;
    }

    return NextResponse.json({ added, missing: missingWeeks });
  } catch (err) {
    console.error("Extend plan error:", err);
    return NextResponse.json({ error: "Erro ao estender plano" }, { status: 500 });
  }
}
