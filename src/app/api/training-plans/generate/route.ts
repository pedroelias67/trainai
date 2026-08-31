export const dynamic = "force-dynamic";
// Generating a plan takes the model ~3-4 minutes. 300s is the Hobby ceiling;
// the 60s written here previously was well under it and cut generation short.
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generatePlanSkeleton, detailSessions } from "@/lib/claude";
import { HORIZON_WEEKS } from "@/lib/plan-horizon";
import { cookies } from "next/headers";

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
    // Counted in days and rounded up: differenceInWeeks truncates, so an event
    // thirteen days away came out as one week and lost half the preparation.
    const diasAteEvento = Math.ceil((event.date.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

    if (diasAteEvento < 3) {
      return NextResponse.json(
        { error: "O evento é demasiado próximo para preparar um plano. São precisos pelo menos 3 dias." },
        { status: 400 }
      );
    }

    const weeksUntilEvent = Math.max(1, Math.ceil(diasAteEvento / 7));

    const user = athlete.user;
    const age = athlete.dateOfBirth
      ? new Date().getFullYear() - athlete.dateOfBirth.getFullYear()
      : 30;

    const athleteContext = {
      name: user.name ?? "Atleta",
      age,
      gender: athlete.gender ?? "MALE",
      fitnessLevel: athlete.fitnessLevel,
      weeklyHours: athlete.weeklyHours ?? 8,
      maxHR: athlete.maxHR ?? undefined,
      ltPace: athlete.ltPace ?? undefined,
    };
    const eventContext = {
      name: event.name,
      sport: event.sport,
      distance: event.distance,
      date: event.date.toISOString().split("T")[0],
      goalType: event.goalType,
      goalTime: event.goalTime ?? undefined,
    };

    // Structure first — seconds rather than minutes — so the athlete gets a
    // browsable plan straight away. The prose follows, one week at a time.
    const planJson = await generatePlanSkeleton({
      athlete: {
        name: user.name ?? "Atleta",
        age,
        gender: athlete.gender ?? "MALE",
        fitnessLevel: athlete.fitnessLevel,
        weeklyHours: athlete.weeklyHours ?? 8,
        trainingDaysPerWeek: athlete.trainingDaysPerWeek ?? undefined,
        longRunDay: athlete.longRunDay ?? undefined,
        preferredDays: athlete.preferredDays.length > 0 ? athlete.preferredDays : undefined,
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
      // Only the horizon is written now; the Monday job tops it up each week, so
      // a plan for an event months away costs the same to create as a short one.
      weeksToGenerate: Math.min(weeksUntilEvent, HORIZON_WEEKS),
    });

    const planData = JSON.parse(planJson);

    // Enforce max sessions per week — priority: LONG > INTERVALS > TEMPO > STRENGTH > EASY > RECOVERY
    const sessionPriority: Record<string, number> = {
      LONG: 6, INTERVALS: 5, TEMPO: 4, STRENGTH: 3, BRICK: 3, SWIM: 3, EASY: 2, RECOVERY: 1, RACE: 7,
    };
    const maxDays = athlete.trainingDaysPerWeek ?? null;
    const preferredDaysSet = athlete.preferredDays.length > 0 ? new Set(athlete.preferredDays) : null;

    for (const week of planData.weeks) {
      // Move sessions that fall outside preferred days to the nearest available day
      if (preferredDaysSet && preferredDaysSet.size > 0) {
        const preferredArr = [...preferredDaysSet].sort((a, b) => a - b);
        for (const session of week.sessions) {
          if (!preferredDaysSet.has(session.dayOfWeek)) {
            // Find closest preferred day
            const closest = preferredArr.reduce((prev: number, curr: number) =>
              Math.abs(curr - session.dayOfWeek) < Math.abs(prev - session.dayOfWeek) ? curr : prev
            );
            session.dayOfWeek = closest;
          }
        }
        // Deduplicate: if two sessions land on the same day, keep the higher-priority one
        const byDay = new Map<number, any>();
        for (const session of week.sessions) {
          const existing = byDay.get(session.dayOfWeek);
          if (!existing || (sessionPriority[session.sessionType] ?? 0) > (sessionPriority[existing.sessionType] ?? 0)) {
            byDay.set(session.dayOfWeek, session);
          }
        }
        week.sessions = [...byDay.values()].sort((a: any, b: any) => a.dayOfWeek - b.dayOfWeek);
      }

      if (maxDays && week.sessions.length > maxDays) {
        week.sessions.sort((a: any, b: any) =>
          (sessionPriority[b.sessionType] ?? 0) - (sessionPriority[a.sessionType] ?? 0)
        );
        week.sessions = week.sessions.slice(0, maxDays);
        week.sessions.sort((a: any, b: any) => a.dayOfWeek - b.dayOfWeek);
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

    // The week grid is always anchored to Monday — session dates are derived from
    // weekStart + (dayOfWeek - 1), so weekStart must be a Monday for days to line up.
    // Sunday (0) → roll to tomorrow's Monday; otherwise fall back to this week's Monday.
    const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const startsNextWeek = dayOfWeek === 0;
    const daysToMonday = startsNextWeek ? 1 : -(dayOfWeek - 1);
    const planStart = new Date(today);
    planStart.setDate(planStart.getDate() + daysToMonday);
    planStart.setHours(0, 0, 0, 0);

    // Week 1 starts today, not last Monday — drop the sessions already in the past
    // and recompute the week totals so the summary matches what's left to train.
    if (!startsNextWeek) {
      const todayDow = dayOfWeek; // 1=Mon ... 6=Sat, matching the session scheme
      const firstWeek = planData.weeks.find((w: any) => w.weekNumber === 1);
      if (firstWeek) {
        firstWeek.sessions = firstWeek.sessions.filter((s: any) => s.dayOfWeek >= todayDow);
        firstWeek.totalDistanceKm = firstWeek.sessions.reduce(
          (sum: number, s: any) => sum + (s.plannedDistanceKm ?? 0), 0
        );
        firstWeek.totalDurationMin = firstWeek.sessions.reduce(
          (sum: number, s: any) => sum + (s.plannedDurationMin ?? 0), 0
        );
      }
    }

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
      include: { weeks: { orderBy: { weekNumber: "asc" }, include: { sessions: true } } },
    });

    // Detail the first week now, so the athlete opens a finished week rather
    // than a set of bare titles. Later weeks are filled in when they are opened.
    // A failure here leaves the plan intact — the detail can be fetched again.
    let firstWeekDetailed = false;
    const firstWeek = plan.weeks[0];
    if (firstWeek && firstWeek.sessions.length > 0) {
      try {
        const details = await detailSessions({
          athlete: athleteContext,
          event: eventContext,
          weekFocus: firstWeek.focus,
          sessions: firstWeek.sessions.map(s => ({
            id: s.id, name: s.name, sport: s.sport, sessionType: s.sessionType,
            dayOfWeek: s.dayOfWeek, plannedDistance: s.plannedDistance,
            plannedDuration: s.plannedDuration, plannedPace: s.plannedPace,
          })),
        });
        const permitidos = new Set(firstWeek.sessions.map(s => s.id));
        for (const d of details) {
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
        }
        firstWeekDetailed = true;
      } catch (detailErr) {
        console.error("First week detailing failed:", detailErr);
      }
    }

    return NextResponse.json({ ...plan, firstWeekDetailed }, { status: 201 });
  } catch (err) {
    console.error("Generate plan error:", err);
    return NextResponse.json({ error: "Erro ao gerar plano" }, { status: 500 });
  }
}
