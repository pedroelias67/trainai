// Matching training already done to the sessions of a plan.
//
// Activities are linked to a session as they arrive from Strava, against
// whichever plan was active then. A plan generated afterwards starts with every
// session unticked, including the ones for days the athlete has already trained
// — so the day they ran this morning reads as missed, and Sunday's analysis
// counts it against them.

import { prisma } from "@/lib/prisma";

export type SessionToMatch = { id: string; date: Date; sport: string };
export type ActivityToMatch = { id: string; date: Date; sport: string };

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/**
 * Pairs each session with an activity from the same day and sport.
 *
 * One activity answers for one session: two runs on a day with one session
 * planned leave the second unmatched, which is the honest reading — the athlete
 * did something extra, not two halves of the same workout.
 */
export function matchSessionsToActivities(
  sessions: SessionToMatch[],
  activities: ActivityToMatch[]
): Array<{ sessionId: string; activityId: string }> {
  const used = new Set<string>();
  const pairs: Array<{ sessionId: string; activityId: string }> = [];

  for (const session of [...sessions].sort((a, b) => a.date.getTime() - b.date.getTime())) {
    const match = activities.find(
      a => !used.has(a.id) && a.sport === session.sport && sameDay(a.date, session.date)
    );
    if (match) {
      used.add(match.id);
      pairs.push({ sessionId: session.id, activityId: match.id });
    }
  }
  return pairs;
}

/**
 * Ticks off the sessions of a plan that the athlete has already trained.
 *
 * Run when a plan is created, so that a plan replacing another does not ask for
 * work already done.
 */
export async function linkTrainedSessions(athleteId: string, planId: string): Promise<number> {
  const now = new Date();
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  const sessions = await prisma.trainingSession.findMany({
    where: { week: { planId, plan: { athleteId } }, completed: false, cancelled: false, date: { lte: endOfToday } },
    select: { id: true, date: true, sport: true },
  });
  if (sessions.length === 0) return 0;

  const earliest = sessions.reduce((a, s) => (s.date < a ? s.date : a), sessions[0].date);
  const from = new Date(earliest);
  from.setHours(0, 0, 0, 0);

  const activities = await prisma.activity.findMany({
    where: { athleteId, date: { gte: from, lte: endOfToday } },
    select: { id: true, date: true, sport: true },
    orderBy: { date: "asc" },
  });

  const pairs = matchSessionsToActivities(sessions, activities);
  for (const { sessionId, activityId } of pairs) {
    await prisma.trainingSession.update({
      where: { id: sessionId },
      data: { completed: true, activityId },
    });
  }
  return pairs.length;
}
