import { prisma } from "@/lib/prisma";
import { athleteProgress, STAGE_ORDER, type Progress } from "@/lib/athlete-progress";

export type UserProgress = {
  userId: string;
  athleteId: string;
  name: string | null;
  email: string;
  createdAt: Date;
  lastLoginAt: Date | null;
  progress: Progress;
  /** When this athlete last had a weekly summary. Null means never. */
  lastReportAt: Date | null;
};

/** Everyone's place on the path from registering to training, the stuck ones first. */
export async function loadProgress(): Promise<UserProgress[]> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [users, activities, upcoming, reports] = await Promise.all([
    prisma.user.findMany({
      where: { athlete: { isNot: null } },
      select: {
        id: true, name: true, email: true, createdAt: true, lastLoginAt: true,
        athlete: {
          select: {
            id: true, dateOfBirth: true, weeklyHours: true,
            _count: { select: { events: true, trainingPlans: true } },
            trainingPlans: { where: { status: "ACTIVE" }, select: { id: true }, take: 1 },
          },
        },
      },
    }),
    prisma.activity.groupBy({ by: ["athleteId"], _count: { _all: true }, _max: { date: true } }),
    prisma.trainingSession.groupBy({
      by: ["weekId"],
      where: { cancelled: false, date: { gte: startOfToday }, week: { plan: { status: "ACTIVE" } } },
      _count: { _all: true },
    }),
    prisma.weeklyReport.groupBy({ by: ["athleteId"], _max: { createdAt: true } }),
  ]);
  const lastReport = new Map(reports.map(r => [r.athleteId, r._max.createdAt]));

  // Sessions come back per week; map them on to their athlete in one more query.
  const weeks = upcoming.length
    ? await prisma.trainingWeek.findMany({
        where: { id: { in: upcoming.map(u => u.weekId) } },
        select: { id: true, plan: { select: { athleteId: true } } },
      })
    : [];
  const aheadByAthlete = new Map<string, number>();
  for (const u of upcoming) {
    const athleteId = weeks.find(w => w.id === u.weekId)?.plan.athleteId;
    if (athleteId) aheadByAthlete.set(athleteId, (aheadByAthlete.get(athleteId) ?? 0) + u._count._all);
  }
  const activityByAthlete = new Map(activities.map(a => [a.athleteId, a]));

  const rows = users.map(u => {
    const a = u.athlete!;
    const act = activityByAthlete.get(a.id);
    return {
      userId: u.id, athleteId: a.id, name: u.name, email: u.email,
      createdAt: u.createdAt, lastLoginAt: u.lastLoginAt,
      lastReportAt: lastReport.get(a.id) ?? null,
      progress: athleteProgress({
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt,
        hasProfile: !!a.dateOfBirth || a.weeklyHours !== null,
        eventCount: a._count.events,
        planCount: a._count.trainingPlans,
        hasActivePlan: a.trainingPlans.length > 0,
        activityCount: act?._count._all ?? 0,
        lastActivityAt: act?._max.date ?? null,
        sessionsAhead: aheadByAthlete.get(a.id) ?? 0,
      }),
    };
  });

  return rows.sort((x, y) =>
    Number(y.progress.stuck) - Number(x.progress.stuck) ||
    STAGE_ORDER.indexOf(x.progress.stage) - STAGE_ORDER.indexOf(y.progress.stage) ||
    x.createdAt.getTime() - y.createdAt.getTime()
  );
}
