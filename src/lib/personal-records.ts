// Derives personal records from activity history.
//
// Runners rarely race the standard distances exactly, so running records are
// extrapolated with Riegel from every activity and the best projection wins.
// Triathlon records use the real total time, since those are raced as such.

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

/** Riegel: T2 = T1 × (D2/D1)^1.06 */
export function riegelTime(knownDist: number, knownTimeSec: number, targetDist: number): number {
  return knownTimeSec * Math.pow(targetDist / knownDist, 1.06);
}

/**
 * Extrapolating a marathon from a 2km jog is meaningless, so an activity only
 * projects on to distances within a sane multiple of what was actually run.
 */
export function canProject(actualMetres: number, targetMetres: number): boolean {
  const ratio = targetMetres / actualMetres;
  return ratio >= 0.25 && ratio <= 4;
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
    select: { id: true, distance: true, duration: true, date: true },
  });

  for (const std of STANDARD_DISTANCES) {
    let best: { timeSeconds: number; activityId: string; date: Date } | null = null;

    for (const act of runs) {
      const dist = act.distance!;
      const dur = act.duration!;
      // Discards GPS glitches and anything that is not running pace.
      const speedKmh = dist / 1000 / (dur / 3600);
      if (speedKmh < 5 || speedKmh > 25) continue;
      if (!canProject(dist, std.meters)) continue;

      const timeSeconds = riegelTime(dist, dur, std.meters);
      if (!best || timeSeconds < best.timeSeconds) {
        best = { timeSeconds, activityId: act.id, date: act.date };
      }
    }

    if (!best) continue;
    await upsertRecord(athleteId, std.meters, best.timeSeconds, best.timeSeconds / (std.meters / 1000), best.activityId, best.date);
    updated.push(std.name);
  }

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
