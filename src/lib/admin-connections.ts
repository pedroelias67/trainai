import { prisma } from "@/lib/prisma";
import { intervalsStatus, stravaStatus, worstLevel, type Level, type LinkStatus } from "@/lib/connection-status";

export type UserConnections = {
  userId: string;
  athleteId: string;
  name: string | null;
  email: string;
  strava: LinkStatus;
  intervals: LinkStatus;
  worst: Level;
  checkedAt: Date | null;
};

const athleteSelect = {
  id: true,
  stravaConnected: true,
  stravaSyncError: true,
  stravaSyncErrorAt: true,
  intervalsIcuApiKey: true,
  intervalsIcuLastPushAt: true,
  intervalsIcuPushError: true,
  intervalsIcuHasRunThreshold: true,
  intervalsIcuCheckedAt: true,
  trainingPlans: { where: { status: "ACTIVE" as const }, select: { id: true }, take: 1 },
} as const;

/** Every athlete's links, most broken first. Reads only what is recorded — no external calls. */
export async function loadConnections(): Promise<UserConnections[]> {
  const [users, lastActivities] = await Promise.all([
    prisma.user.findMany({
      where: { athlete: { isNot: null } },
      select: { id: true, name: true, email: true, athlete: { select: athleteSelect } },
    }),
    prisma.activity.groupBy({ by: ["athleteId"], _max: { date: true } }),
  ]);
  const lastActivity = new Map(lastActivities.map(a => [a.athleteId, a._max.date]));

  const rows = users.map(u => {
    const a = u.athlete!;
    const facts = {
      stravaConnected: a.stravaConnected,
      stravaSyncError: a.stravaSyncError,
      stravaSyncErrorAt: a.stravaSyncErrorAt,
      lastActivityAt: lastActivity.get(a.id) ?? null,
      intervalsConnected: !!a.intervalsIcuApiKey,
      intervalsIcuLastPushAt: a.intervalsIcuLastPushAt,
      intervalsIcuPushError: a.intervalsIcuPushError,
      intervalsIcuHasRunThreshold: a.intervalsIcuHasRunThreshold,
      hasActivePlan: a.trainingPlans.length > 0,
    };
    const strava = stravaStatus(facts);
    const intervals = intervalsStatus(facts);
    return {
      userId: u.id, athleteId: a.id, name: u.name, email: u.email,
      strava, intervals, worst: worstLevel(strava.level, intervals.level),
      checkedAt: a.intervalsIcuCheckedAt,
    };
  });

  const rank: Record<Level, number> = { error: 0, warning: 1, ok: 2, off: 3 };
  return rows.sort((x, y) => rank[x.worst] - rank[y.worst] || (x.name ?? x.email).localeCompare(y.name ?? y.email));
}
