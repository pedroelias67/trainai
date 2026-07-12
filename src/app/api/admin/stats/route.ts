export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "pedroelias67@gmail.com";

async function requireAdmin() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("user_id")?.value;
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.email !== ADMIN_EMAIL) return null;
  return user;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    verifiedUsers,
    usersThisWeek,
    totalAthletes,
    activePlans,
    totalActivities,
    activitiesThisWeek,
    totalKmAgg,
    stravaConnected,
    topAthletesRaw,
    recentRegistrations,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { emailVerified: true } }),
    prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.athlete.count(),
    prisma.trainingPlan.count({ where: { status: "ACTIVE" } }),
    prisma.activity.count(),
    prisma.activity.count({ where: { date: { gte: sevenDaysAgo } } }),
    prisma.activity.aggregate({ _sum: { distance: true } }),
    prisma.athlete.count({ where: { stravaConnected: true } }),
    prisma.athlete.findMany({
      include: {
        user: { select: { name: true, email: true } },
        _count: { select: { activities: true } },
      },
      orderBy: { activities: { _count: "desc" } },
      take: 5,
    }),
    prisma.user.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  // Compute total km per top athlete
  const topAthletes = await Promise.all(
    topAthletesRaw.map(async (a) => {
      const distAgg = await prisma.activity.aggregate({
        where: { athleteId: a.id },
        _sum: { distance: true },
      });
      return {
        id: a.id,
        name: a.user.name ?? a.user.email,
        activityCount: a._count.activities,
        totalKm: Math.round(((distAgg._sum.distance ?? 0) / 1000) * 10) / 10,
      };
    })
  );

  // Group registrations by day for last 30 days
  const dayMap: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    dayMap[d.toISOString().slice(0, 10)] = 0;
  }
  for (const u of recentRegistrations) {
    const key = new Date(u.createdAt).toISOString().slice(0, 10);
    if (key in dayMap) dayMap[key]++;
  }
  const registrationsByDay = Object.entries(dayMap).map(([date, count]) => ({ date, count }));

  return NextResponse.json({
    totalUsers,
    verifiedUsers,
    usersThisWeek,
    totalAthletes,
    activePlans,
    totalActivities,
    activitiesThisWeek,
    totalKm: Math.round(((totalKmAgg._sum.distance ?? 0) / 1000) * 10) / 10,
    stravaConnected,
    topAthletes,
    registrationsByDay,
  });
}
