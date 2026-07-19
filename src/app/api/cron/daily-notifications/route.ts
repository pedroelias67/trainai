export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { isToday } from "date-fns";

// Called by Vercel Cron every morning at 7:30 AM
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find all athletes with push subscriptions and active plans
  const athletes = await prisma.athlete.findMany({
    where: {
      NOT: { pushSubscription: { equals: Prisma.JsonNull } },
      trainingPlans: { some: { status: "ACTIVE" } },
    },
    include: {
      trainingPlans: {
        where: { status: "ACTIVE" },
        include: {
          weeks: {
            include: {
              sessions: {
                where: { cancelled: false, completed: false },
                orderBy: { date: "asc" },
              },
            },
          },
        },
        take: 1,
      },
    },
  });

  let sent = 0;

  for (const athlete of athletes) {
    const plan = athlete.trainingPlans[0];
    if (!plan) continue;

    // Find today's sessions across all weeks
    const todaySessions = plan.weeks
      .flatMap((w) => w.sessions)
      .filter((s) => isToday(new Date(s.date)));

    if (todaySessions.length === 0) continue;

    const prioritySession = todaySessions.find((s) => s.isPriority);
    const session = prioritySession ?? todaySessions[0];

    const isPriority = !!prioritySession;
    const title = isPriority
      ? `⭐ Treino prioritário hoje — não faltes!`
      : `🏃 Treino hoje`;

    const details = [
      session.name,
      session.plannedDistance ? `${session.plannedDistance}km` : null,
      session.plannedDuration ? `${session.plannedDuration}min` : null,
    ].filter(Boolean).join(" · ");

    const body = isPriority
      ? `${details} — Este é o treino mais importante desta semana.`
      : details;

    // Send via web push
    const sub = athlete.pushSubscription as any;
    if (!sub?.endpoint) continue;

    try {
      const webpush = await import("web-push");
      webpush.default.setVapidDetails(
        "mailto:pedro@pedroelias.com",
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
        process.env.VAPID_PRIVATE_KEY!
      );
      await webpush.default.sendNotification(
        sub,
        JSON.stringify({ title, body, url: "/dashboard" })
      );
      sent++;
    } catch {
      // Subscription expired — clean up
      await prisma.athlete.update({
        where: { id: athlete.id },
        data: { pushSubscription: Prisma.JsonNull },
      }).catch(() => {});
    }
  }

  return NextResponse.json({ sent, athletes: athletes.length });
}
