import { prisma } from "@/lib/prisma";
import { watchNotice, type WatchNotice } from "@/lib/connection-status";

/**
 * What to tell this athlete about their workouts reaching their watch.
 *
 * Reads only what is already recorded — the same columns the admin page reads,
 * written when a week is sent — so showing this on a page costs one small query
 * and never an external call.
 */
export async function loadWatchNotice(athleteId: string): Promise<WatchNotice | null> {
  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    select: {
      stravaConnected: true,
      stravaSyncError: true,
      stravaSyncErrorAt: true,
      intervalsIcuApiKey: true,
      intervalsIcuLastPushAt: true,
      intervalsIcuPushError: true,
      intervalsIcuHasRunThreshold: true,
      intervalsIcuWeekOnCalendar: true,
      trainingPlans: { where: { status: "ACTIVE" }, select: { id: true }, take: 1 },
    },
  });
  if (!athlete) return null;

  return watchNotice({
    stravaConnected: athlete.stravaConnected,
    stravaSyncError: athlete.stravaSyncError,
    stravaSyncErrorAt: athlete.stravaSyncErrorAt,
    // Not read for the watch verdict; Strava is a separate question.
    lastActivityAt: null,
    intervalsConnected: !!athlete.intervalsIcuApiKey,
    intervalsIcuLastPushAt: athlete.intervalsIcuLastPushAt,
    intervalsIcuPushError: athlete.intervalsIcuPushError,
    intervalsIcuHasRunThreshold: athlete.intervalsIcuHasRunThreshold,
    intervalsIcuWeekOnCalendar: athlete.intervalsIcuWeekOnCalendar,
    hasActivePlan: athlete.trainingPlans.length > 0,
  });
}
