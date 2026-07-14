export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateTrainingPlan } from "@/lib/claude";
import { cookies } from "next/headers";
import { differenceInWeeks } from "date-fns";

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get("user_id")?.value;
    if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const body = await req.json();
    const { eventId } = body;

    const athlete = await prisma.athlete.findUnique({
      where: { userId },
      include: { user: true },
    });
    if (!athlete) return NextResponse.json({ error: "Atleta não encontrado" }, { status: 404 });

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event || event.athleteId !== athlete.id) {
      return NextResponse.json({ error: "Evento não encontrado" }, { status: 404 });
    }

    const today = new Date();
    const weeksUntilEvent = differenceInWeeks(event.date, today);

    if (weeksUntilEvent < 4) {
      return NextResponse.json({ error: "Evento demasiado próximo (mínimo 4 semanas)" }, { status: 400 });
    }

    const user = athlete.user;
    const age = athlete.dateOfBirth
      ? new Date().getFullYear() - athlete.dateOfBirth.getFullYear()
      : 30;

    const planJson = await generateTrainingPlan({
      athlete: {
        name: user.name ?? "Atleta",
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
        name: event.name,
        sport: event.sport,
        distance: event.distance,
        date: event.date.toISOString().split("T")[0],
        goalType: event.goalType,
        goalTime: event.goalTime ?? undefined,
      },
      currentDate: today.toISOString().split("T")[0],
      weeksUntilEvent,
    });

    const planData = JSON.parse(planJson);

    // Enforce max sessions per week — priority: LONG > INTERVALS > TEMPO > STRENGTH > EASY > RECOVERY
    const sessionPriority: Record<string, number> = {
      LONG: 6, INTERVALS: 5, TEMPO: 4, STRENGTH: 3, BRICK: 3, SWIM: 3, EASY: 2, RECOVERY: 1, RACE: 7,
    };
    const maxDays = athlete.trainingDaysPerWeek ?? null;
    if (maxDays) {
      for (const week of planData.weeks) {
        if (week.sessions.length > maxDays) {
          week.sessions.sort((a: any, b: any) =>
            (sessionPriority[b.sessionType] ?? 0) - (sessionPriority[a.sessionType] ?? 0)
          );
          week.sessions = week.sessions.slice(0, maxDays);
          // Re-sort by dayOfWeek after trimming
          week.sessions.sort((a: any, b: any) => a.dayOfWeek - b.dayOfWeek);
        }
      }
    }

    // Normalizar valores do enum gerados pela IA
    const sessionTypeMap: Record<string, string> = {
      LONG_RUN: "LONG", LONG_RIDE: "LONG", LONG_SWIM: "LONG",
      INTERVAL: "INTERVALS", SPEED: "INTERVALS", FARTLEK: "INTERVALS",
      THRESHOLD: "TEMPO", AEROBIC: "EASY", BASE: "EASY",
    };
    const sportMap: Record<string, string> = {
      RUN: "RUNNING", BIKE: "CYCLING", CYCLE: "CYCLING", SWIM: "SWIMMING",
    };

    // Align plan start to next Monday
    const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const daysUntilMonday = dayOfWeek === 1 ? 0 : dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
    const planStart = new Date(today);
    planStart.setDate(planStart.getDate() + daysUntilMonday);
    planStart.setHours(0, 0, 0, 0);

    const plan = await prisma.trainingPlan.create({
      data: {
        athleteId: athlete.id,
        eventId: event.id,
        name: planData.planName,
        startDate: planStart,
        endDate: event.date,
        totalWeeks: weeksUntilEvent,
        periodization: planData.periodization,
        coachNotes: planData.coachNotes,
        aiPromptContext: planData.periodization,
        weeks: {
          create: planData.weeks.map((week: any) => {
            const weekStart = new Date(planStart.getTime() + (week.weekNumber - 1) * 7 * 24 * 60 * 60 * 1000);
            const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
            weekEnd.setHours(23, 59, 59, 999);
            return {
            weekNumber: week.weekNumber,
            startDate: weekStart,
            endDate: weekEnd,
            focus: week.focus,
            coachMessage: week.coachMessage,
            totalDistance: week.totalDistanceKm,
            totalDuration: week.totalDurationMin,
            sessions: {
              create: week.sessions.map((session: any) => {
                // dayOfWeek: 1=Mon, 2=Tue, ..., 7=Sun
                const sessionDate = new Date(weekStart.getTime());
                sessionDate.setDate(sessionDate.getDate() + (session.dayOfWeek - 1));
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
                    session.sessionType === "LONG" ||
                    session.sessionType === "BRICK"
                  ),
                };
              }),
            },
            };
          }),
        },
      },
      include: { weeks: { include: { sessions: true } } },
    });

    return NextResponse.json(plan, { status: 201 });
  } catch (err) {
    console.error("Generate plan error:", err);
    return NextResponse.json({ error: "Erro ao gerar plano" }, { status: 500 });
  }
}
