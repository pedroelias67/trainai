export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { analyzeWeekAndAdapt } from "@/lib/claude";
import { startOfWeek, endOfWeek, subWeeks } from "date-fns";

// Called by Vercel Cron every Sunday at 20:00
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const lastWeekStart = startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 });
  const lastWeekEnd = endOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 });

  // Find all active training weeks that ended last week
  const weeks = await prisma.trainingWeek.findMany({
    where: {
      startDate: { gte: lastWeekStart },
      endDate: { lte: lastWeekEnd },
      weeklyReport: null, // only weeks without a report
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
  });

  let generated = 0;

  for (const week of weeks) {
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

      generated++;
    } catch (err) {
      console.error(`Weekly report error for week ${week.id}:`, err);
    }
  }

  return NextResponse.json({ generated, weeks: weeks.length });
}
