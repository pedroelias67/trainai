// Derives personal records from activity history.
//
// A record is something the athlete actually ran. Nothing is extrapolated:
// predicted times for distances not yet raced belong to the race predictor on
// the dashboard, and calling those "records" would misrepresent them.
//
// The source is Strava's best efforts. For every run Strava measures the fastest
// stretch of each standard distance along the GPS track, by elapsed time — the
// same figures its own records list and a Garmin show. Summing whole-kilometre
// splits, which this used to do, cannot see a stop: splits are paced on moving
// time, so a run with ten minutes standing at traffic lights produced a 5K
// "record" ten minutes faster than anything the athlete ran.

import { prisma } from "@/lib/prisma";
import { Sport } from "@prisma/client";
import { formatPacePerKm } from "@/lib/format";

const STANDARD_DISTANCES = [
  { name: "5 km", meters: 5000, stravaEffort: "5K" },
  { name: "10 km", meters: 10000, stravaEffort: "10K" },
  { name: "Meia Maratona", meters: 21097, stravaEffort: "Half-Marathon" },
  { name: "Maratona", meters: 42195, stravaEffort: "Marathon" },
];

const TRIATHLON_DISTANCES: Record<string, { name: string; totalMeters: number }> = {
  TRIATHLON_SPRINT: { name: "Triatlo Sprint", totalMeters: 25750 },
  TRIATHLON_OLYMPIC: { name: "Triatlo Olímpico", totalMeters: 51500 },
  TRIATHLON_HALF: { name: "Half Ironman", totalMeters: 112900 },
  TRIATHLON_FULL: { name: "Ironman", totalMeters: 225800 },
};

const TRIATHLON_SPORTS: Sport[] = [
  Sport.TRIATHLON_SPRINT, Sport.TRIATHLON_OLYMPIC, Sport.TRIATHLON_HALF, Sport.TRIATHLON_FULL,
];

export const formatPace = formatPacePerKm;

/**
 * Whether an activity as a whole covers a standard distance — the fallback for
 * runs without best efforts. GPS undershoots a little, and races are run a few
 * percent long by taking wide lines, so a narrow band around the target is
 * allowed. The time is used as it stands, never scaled.
 */
export function matchesDistance(actualMetres: number, targetMetres: number): boolean {
  return actualMetres >= targetMetres * 0.99 && actualMetres <= targetMetres * 1.05;
}

/** What records are computed from, per run. */
export type RunForRecords = {
  id: string;
  date: Date;
  distance: number;
  /** Moving time, as stored on the activity. */
  duration: number;
  /** Strava's elapsed time: stops included, which is what a record must be. */
  elapsedTime: number | null;
  /** Strava's best_efforts, untouched. Null when the run has none. */
  bestEfforts: unknown;
};

/** Elapsed seconds of a named Strava best effort, or null if the run has none. */
export function bestEffortSeconds(bestEfforts: unknown, name: string): number | null {
  if (!Array.isArray(bestEfforts)) return null;
  const effort = bestEfforts.find(e => e?.name === name);
  const secs = Number(effort?.elapsed_time);
  return Number.isFinite(secs) && secs > 0 ? secs : null;
}

/**
 * The fastest time for one standard distance across a set of runs.
 *
 * A run counts through its Strava best effort for that distance. Failing that —
 * no GPS, typed in by hand, or a track measured just short — it counts only when
 * the whole run is that distance, by its elapsed time where known.
 */
export function bestTimeForDistance(
  runs: RunForRecords[],
  distance: { meters: number; stravaEffort: string }
): { timeSeconds: number; activityId: string; date: Date } | null {
  let best: { timeSeconds: number; activityId: string; date: Date } | null = null;

  for (const run of runs) {
    // Discards GPS glitches and anything that is not running pace.
    const speedKmh = run.distance / 1000 / (run.duration / 3600);
    if (!(speedKmh >= 5 && speedKmh <= 25)) continue;

    // Strava only measures an effort the GPS track is long enough for, so a race
    // the watch measured a touch short has none: the whole run stands in.
    const time =
      bestEffortSeconds(run.bestEfforts, distance.stravaEffort) ??
      (matchesDistance(run.distance, distance.meters) ? run.elapsedTime ?? run.duration : null);

    if (time !== null && (!best || time < best.timeSeconds)) {
      best = { timeSeconds: time, activityId: run.id, date: run.date };
    }
  }
  return best;
}

async function upsertRecord(
  athleteId: string,
  distance: number,
  timeSeconds: number,
  paceSecPerKm: number,
  activityId: string,
  date: Date
) {
  const existing = await prisma.personalRecord.findFirst({
    where: { athleteId, distance },
    select: { id: true },
  });
  const data = { timeSeconds, pace: formatPace(paceSecPerKm), date, activityId };

  if (existing) {
    await prisma.personalRecord.update({ where: { id: existing.id }, data });
  } else {
    await prisma.personalRecord.create({ data: { athleteId, distance, ...data } });
  }
}

export async function recalculatePersonalRecords(athleteId: string): Promise<string[]> {
  const updated: string[] = [];

  // Only the two fields needed out of the raw Strava payload, which also carries
  // laps and segment efforts and is far too heavy to load whole for every run.
  const rows = await prisma.$queryRaw<Array<{
    id: string; date: Date; distance: number; duration: number;
    elapsedTime: number | null; bestEfforts: unknown;
  }>>`
    SELECT id, date, distance, duration,
           ("rawData"->>'elapsed_time')::float AS "elapsedTime",
           "rawData"->'best_efforts' AS "bestEfforts"
    FROM "Activity"
    WHERE "athleteId" = ${athleteId} AND sport = 'RUNNING'
      AND distance IS NOT NULL AND duration IS NOT NULL
  `;
  const runs: RunForRecords[] = rows;

  for (const std of STANDARD_DISTANCES) {
    const best = bestTimeForDistance(runs, std);
    if (!best) continue;
    await upsertRecord(athleteId, std.meters, best.timeSeconds, best.timeSeconds / (std.meters / 1000), best.activityId, best.date);
    updated.push(std.name);
  }

  // Records from extrapolation should not survive the switch to real distances.
  const realDistances = STANDARD_DISTANCES.map(s => s.meters);
  await prisma.personalRecord.deleteMany({
    where: {
      athleteId,
      distance: { in: realDistances },
      NOT: { distance: { in: STANDARD_DISTANCES.filter(s => updated.includes(s.name)).map(s => s.meters) } },
    },
  });

  const triathlons = await prisma.activity.findMany({
    where: { athleteId, sport: { in: TRIATHLON_SPORTS }, duration: { not: null } },
    select: { id: true, sport: true, duration: true, date: true },
  });

  for (const [sport, dist] of Object.entries(TRIATHLON_DISTANCES)) {
    const matching = triathlons.filter(a => a.sport === sport);
    if (matching.length === 0) continue;

    const best = matching.reduce((a, b) => (b.duration! < a.duration! ? b : a));
    await upsertRecord(athleteId, dist.totalMeters, best.duration!, best.duration! / (dist.totalMeters / 1000), best.id, best.date);
    updated.push(dist.name);
  }

  return updated;
}
