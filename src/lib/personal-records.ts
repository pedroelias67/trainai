// Derives personal records from activity history.
//
// A record is something the athlete actually ran. Only activities that genuinely
// cover the distance count, using their real time — no extrapolation. Predicted
// times for distances not yet raced belong to the race predictor on the
// dashboard, and calling those "records" would misrepresent them.

import { prisma } from "@/lib/prisma";
import { Sport } from "@prisma/client";

const STANDARD_DISTANCES = [
  { name: "5 km", meters: 5000 },
  { name: "10 km", meters: 10000 },
  { name: "Meia Maratona", meters: 21097 },
  { name: "Maratona", meters: 42195 },
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

export function formatPace(secondsPerKm: number): string {
  const mins = Math.floor(secondsPerKm / 60);
  const secs = Math.round(secondsPerKm % 60);
  return `${mins}:${String(secs).padStart(2, "0")}/km`;
}

/**
 * Whether an activity really covers a standard distance. GPS undershoots a
 * little, and races are run a few percent long by taking wide lines, so a
 * narrow band around the target is allowed. The recorded time is then used as
 * it stands — never scaled — so a record can only ever be honest or slightly
 * pessimistic, never flattering.
 */
export function matchesDistance(actualMetres: number, targetMetres: number): boolean {
  return actualMetres >= targetMetres * 0.99 && actualMetres <= targetMetres * 1.05;
}

export type Split = { km: number; pace: string | null };

/** "5:25/km" → 325 seconds. */
export function paceToSeconds(pace: string | null): number | null {
  if (!pace) return null;
  const m = pace.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const secs = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  return secs > 0 ? secs : null;
}

/**
 * Fastest continuous stretch of `targetKm` inside a longer run, the way a watch
 * reports a best effort. Only whole kilometre splits are used: the last split of
 * an activity is usually a partial kilometre, and its per-km pace would count as
 * a full one. Returns null when the run is simply not long enough.
 */
export function bestEffortFromSplits(
  splits: Split[],
  activityMetres: number,
  targetKm: number
): number | null {
  const wholeKm = Math.floor(activityMetres / 1000);
  const usable = splits
    .slice(0, wholeKm)
    .map(s => paceToSeconds(s.pace));

  if (usable.length < targetKm || usable.some(s => s === null)) return null;

  let best: number | null = null;
  for (let i = 0; i + targetKm <= usable.length; i++) {
    let sum = 0;
    for (let j = i; j < i + targetKm; j++) sum += usable[j]!;
    if (best === null || sum < best) best = sum;
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

  const runs = await prisma.activity.findMany({
    where: { athleteId, sport: "RUNNING", distance: { not: null }, duration: { not: null } },
    select: { id: true, distance: true, duration: true, date: true, splits: true },
  });

  for (const std of STANDARD_DISTANCES) {
    let best: { timeSeconds: number; activityId: string; date: Date } | null = null;

    for (const act of runs) {
      const dist = act.distance!;
      const dur = act.duration!;
      // Discards GPS glitches and anything that is not running pace.
      const speedKmh = dist / 1000 / (dur / 3600);
      if (speedKmh < 5 || speedKmh > 25) continue;

      // The whole activity was that distance, so its time is the record.
      let timeSeconds: number | null = matchesDistance(dist, std.meters) ? dur : null;

      // Otherwise look for the distance run as a stretch inside a longer effort.
      // Splits are whole kilometres, so this only applies to distances that are
      // themselves whole kilometres — summing 21 of them would be 97m short of a
      // half marathon and would flatter the time.
      const isWholeKm = std.meters % 1000 === 0;
      if (timeSeconds === null && isWholeKm && dist > std.meters && Array.isArray(act.splits)) {
        timeSeconds = bestEffortFromSplits(
          act.splits as unknown as Split[],
          dist,
          std.meters / 1000
        );
      }

      if (timeSeconds !== null && (!best || timeSeconds < best.timeSeconds)) {
        best = { timeSeconds, activityId: act.id, date: act.date };
      }
    }

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
