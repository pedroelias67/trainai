export const dynamic = "force-dynamic";
// Generating a plan takes the model ~3-4 minutes. 300s is the Hobby ceiling;
// the 60s written here previously was well under it and cut generation short.
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { analyzeWeekAndAdapt, suggestSessionAdaptations, detailSessions } from "@/lib/claude";
import { sendWeeklyReportEmail } from "@/lib/email";
import * as Sentry from "@sentry/nextjs";
import { differenceInWeeks } from "date-fns";
import { startOfWeek, endOfWeek, subDays, startOfDay } from "date-fns";

// Work is stopped at this point and handed to a fresh invocation, leaving room
// within the 300s limit to finish the athlete in progress.
const BUDGET_MS = 200_000;
// Bounds the self-continuation, so a persistent failure cannot loop forever.
const MAX_DEPTH = 10;

// Called by Vercel Cron every Sunday at 20:00
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const depth = Number(new URL(req.url).searchParams.get("depth") ?? 0);

  // The job runs on Sunday evening, so the week being reported on is the one
  // now ending — not subWeeks(now, 1), which pointed at the week before that
  // and matched nothing for a plan in its first week.
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

  // Matching on startDate alone: a week that starts inside the window ends
  // inside it by construction, and comparing endDate meant relying on two
  // separately computed timestamps agreeing to the millisecond — which they
  // only do while the server happens to run in UTC.
  const allWeeks = await prisma.trainingWeek.findMany({
    where: {
      startDate: { gte: weekStart, lte: weekEnd },
      weeklyReport: null, // only weeks without a report
      // Archived plans still hold weeks covering these dates; reporting on a
      // plan the athlete has replaced would be noise.
      plan: { status: "ACTIVE" },
    },
    include: {
      sessions: true,
      plan: {
        include: {
          event: true,
          athlete: { include: { user: true } },
        },
      },
    },
    orderBy: { plan: { createdAt: "desc" } },
  });

  // Deduplicate: one week per athlete (newest plan wins)
  const seen = new Set<string>();
  const weeks = allWeeks.filter(w => {
    const athleteId = w.plan.athleteId;
    if (seen.has(athleteId)) return false;
    seen.add(athleteId);
    return true;
  });

  let generated = 0;
  let restantes = false;

  for (const week of weeks) {
    // Each athlete costs three model calls — analysis, detailing, adaptation —
    // so a handful of them would exceed the function limit and the last ones
    // would be cut off silently, mid-loop. Stop before that and hand the rest
    // to a fresh invocation; athletes already done drop out of the query, so
    // the continuation picks up exactly where this left off.
    if (Date.now() - startedAt > BUDGET_MS) {
      restantes = true;
      break;
    }

    const athlete = week.plan.athlete;
    try {
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

      await prisma.weeklyReport.upsert({
        where: { weekId: week.id },
        create: {
          athleteId: athlete.id,
          weekId: week.id,
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

      // Auto-adapt NEXT week's sessions based on this analysis
      let adaptationFailed = false;
      try {
        const nextWeek = await prisma.trainingWeek.findFirst({
          where: { planId: week.planId, weekNumber: week.weekNumber + 1 },
          include: { sessions: { where: { cancelled: false, completed: false } } },
        });
        // Write the coaching for the week that is about to start, before the
        // adaptation runs. Doing it afterwards would overwrite the coachTip the
        // adaptation uses to explain each adjustment — and Sunday evening is
        // when the athlete looks ahead, so it should be ready by then.
        if (nextWeek) {
          const porDetalhar = nextWeek.sessions.filter(s => !s.mainSet);
          if (porDetalhar.length > 0) {
            try {
              const details = await detailSessions({
                athlete: {
                  name: athlete.user.name ?? "Atleta",
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
                weekFocus: nextWeek.focus,
                sessions: porDetalhar.map(s => ({
                  id: s.id, name: s.name, sport: s.sport, sessionType: s.sessionType,
                  dayOfWeek: s.dayOfWeek, plannedDistance: s.plannedDistance,
                  plannedDuration: s.plannedDuration, plannedPace: s.plannedPace,
                })),
              });
              const permitidos = new Set(porDetalhar.map(s => s.id));
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
                ...(d.steps ? { steps: d.steps as object } : {}),
                  },
                });
              }
            } catch (detailErr) {
              // The athlete can still fetch it by opening the session.
              console.error("Next week detailing failed:", detailErr);
              Sentry.captureException(detailErr, {
                tags: { job: "weekly-report", stage: "detailing" },
                extra: { athleteId: athlete.id, weekId: nextWeek.id },
              });
            }
          }
        }

        if (nextWeek && !nextWeek.adaptationsApplied && nextWeek.sessions.length > 0) {
          const wellnessLogs = await prisma.wellnessLog.findMany({
            where: { athleteId: athlete.id, date: { gte: subDays(startOfDay(new Date()), 7) } },
            orderBy: { date: "desc" },
          });
          const wellnessSummary = wellnessLogs.length > 0
            ? wellnessLogs.map(l => `${l.date.toISOString().split("T")[0]}: sono=${l.sleepQuality ?? "?"}/5 fadiga=${l.fatigue ?? "?"}/5 humor=${l.mood ?? "?"}/5`).join("\n")
            : "Sem dados de bem-estar";

          const adjustments = await suggestSessionAdaptations({
            analysis: analysis.summary,
            nextWeekAdjustments: analysis.nextWeekAdjustments,
            wellnessSummary,
            sessions: nextWeek.sessions.map(s => ({
              id: s.id, name: s.name, sessionType: s.sessionType,
              plannedDistance: s.plannedDistance, plannedDuration: s.plannedDuration, plannedPace: s.plannedPace,
            })),
          });

          for (const adj of adjustments) {
            const session = nextWeek.sessions.find(s => s.id === adj.sessionId);
            if (!session || adj.action === "keep") continue;
            const update: Record<string, unknown> = {};
            if (adj.action === "convert_to_easy" || adj.convertToType) {
              update.sessionType = adj.convertToType ?? "EASY";
              update.name = `[Adaptado] ${session.name}`;
              update.coachTip = adj.reason;
            }
            if (adj.distanceMultiplier && session.plannedDistance)
              update.plannedDistance = Math.round(session.plannedDistance * adj.distanceMultiplier * 10) / 10;
            if (adj.durationMultiplier && session.plannedDuration)
              update.plannedDuration = Math.round(session.plannedDuration * adj.durationMultiplier);
            if (Object.keys(update).length > 0)
              await prisma.trainingSession.update({ where: { id: adj.sessionId }, data: update });
          }

          const adaptationSummary = adjustments
            .filter(a => a.action !== "keep")
            .map(a => `• ${nextWeek.sessions.find(s => s.id === a.sessionId)?.name ?? a.sessionId}: ${a.reason}`)
            .join("\n");

          await prisma.trainingWeek.update({
            where: { id: nextWeek.id },
            data: { adaptationsApplied: true, adaptations: adaptationSummary || "Plano mantém-se." },
          });
        }
      } catch (adaptErr) {
        // The report is still worth sending, but the athlete must not be left
        // assuming next week was adjusted when it was not.
        adaptationFailed = true;
        console.error("Adaptation error:", adaptErr);
        Sentry.captureException(adaptErr, {
          tags: { job: "weekly-report", stage: "adaptation" },
          extra: { athleteId: athlete.id, weekId: week.id, weekNumber: week.weekNumber },
        });
      }

      // Send push notification if athlete has subscription
      if (athlete.pushSubscription) {
        const sub = athlete.pushSubscription as any;
        if (sub?.endpoint) {
          try {
            const webpush = await import("web-push");
            webpush.default.setVapidDetails(
              "mailto:pedro@pedroelias.com",
              process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
              process.env.VAPID_PRIVATE_KEY!
            );
            const completed = week.sessions.filter((s) => s.completed).length;
            await webpush.default.sendNotification(
              sub,
              JSON.stringify({
                title: "📊 Relatório semanal disponível",
                body: `Completaste ${completed} de ${week.sessions.length} treinos esta semana. Vê a análise do teu treinador IA.`,
                url: "/dashboard/plan",
              })
            );
          } catch {}
        }
      }

      // Send weekly email report
      try {
        const report = await prisma.weeklyReport.findUnique({ where: { weekId: week.id } });
        const weeksToEvent = Math.max(
          differenceInWeeks(week.plan.event.date, new Date()),
          0
        );
        await sendWeeklyReportEmail(athlete.user.email, athlete.user.name ?? "Atleta", {
          weekNumber: week.weekNumber,
          completedSessions: report?.completedSessions ?? week.sessions.filter(s => s.completed).length,
          plannedSessions: week.sessions.length,
          actualDistance: report?.actualDistance ?? 0,
          plannedDistance: week.totalDistance,
          aiSummary: analysis.summary,
          nextWeekAdaptations: analysis.nextWeekAdjustments ?? null,
          eventName: week.plan.event.name,
          weeksToEvent,
          adaptationFailed,
        });
      } catch (emailErr) {
        console.error("Weekly email error:", emailErr);
        Sentry.captureException(emailErr, {
          tags: { job: "weekly-report", stage: "email" },
          extra: { athleteId: athlete.id, weekId: week.id },
        });
      }

      generated++;
    } catch (err) {
      console.error(`Weekly report error for week ${week.id}:`, err);
      Sentry.captureException(err, {
        tags: { job: "weekly-report", stage: "week" },
        extra: { weekId: week.id },
      });
    }
  }

  if (restantes && depth < MAX_DEPTH && process.env.NEXTAUTH_URL) {
    // Dispatch the continuation and abort locally: waiting for it would nest
    // the remaining work inside this invocation's budget, which is the problem
    // being solved. The receiving invocation runs on its own.
    await fetch(
      `${process.env.NEXTAUTH_URL}/api/cron/weekly-report?depth=${depth + 1}`,
      {
        headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
        signal: AbortSignal.timeout(2000),
      }
    ).catch(() => {});
  }

  return NextResponse.json({ generated, weeks: weeks.length, depth, restantes });
}
