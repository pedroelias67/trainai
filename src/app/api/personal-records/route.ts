export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { Sport } from "@prisma/client";

const STANDARD_DISTANCES = [
  { name: "5 km", meters: 5000, minM: 4500, maxM: 5500 },
  { name: "10 km", meters: 10000, minM: 9000, maxM: 11000 },
  { name: "Meia Maratona", meters: 21097, minM: 20000, maxM: 22200 },
  { name: "Maratona", meters: 42195, minM: 40000, maxM: 44400 },
];

const TRIATHLON_DISTANCES = [
  { name: "Triatlo Sprint", totalMeters: 25750, swimM: 750, bikeM: 20000, runM: 5000 },
  { name: "Triatlo Olímpico", totalMeters: 51500, swimM: 1500, bikeM: 40000, runM: 10000 },
  { name: "Half Ironman", totalMeters: 112900, swimM: 1900, bikeM: 90000, runM: 21100 },
  { name: "Ironman", totalMeters: 225800, swimM: 3800, bikeM: 180000, runM: 42200 },
];

const TRIATHLON_SPORTS: Sport[] = [Sport.TRIATHLON_SPRINT, Sport.TRIATHLON_OLYMPIC, Sport.TRIATHLON_HALF, Sport.TRIATHLON_FULL];

function formatPace(secondsPerKm: number): string {
  const mins = Math.floor(secondsPerKm / 60);
  const secs = Math.round(secondsPerKm % 60);
  return `${mins}:${String(secs).padStart(2, "0")}/km`;
}

function riegelTime(knownDist: number, knownTimeSec: number, targetDist: number): number {
  // Riegel formula: T2 = T1 * (D2/D1)^1.06
  return knownTimeSec * Math.pow(targetDist / knownDist, 1.06);
}

export async function GET() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("user_id")?.value;
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const athlete = await prisma.athlete.findUnique({ where: { userId } });
  if (!athlete) return NextResponse.json({ error: "Atleta não encontrado" }, { status: 404 });

  const records = await prisma.personalRecord.findMany({
    where: { athleteId: athlete.id },
    orderBy: { distance: "asc" },
  });

  return NextResponse.json(records);
}

async function upsertRecord(
  athleteId: string,
  distanceMeters: number,
  name: string,
  timeSeconds: number,
  paceSecPerKm: number,
  activityId: string,
  date: Date,
  upserted: string[]
) {
  const existing = await prisma.personalRecord.findFirst({
    where: { athleteId, distance: distanceMeters },
    select: { id: true },
  });

  if (existing) {
    await prisma.personalRecord.update({
      where: { id: existing.id },
      data: { timeSeconds, pace: formatPace(paceSecPerKm), date, activityId },
    });
  } else {
    await prisma.personalRecord.create({
      data: { athleteId, distance: distanceMeters, timeSeconds, pace: formatPace(paceSecPerKm), date, activityId },
    });
  }
  upserted.push(name);
}

export async function POST(_req: NextRequest) {
  const cookieStore = await cookies();
  const userId = cookieStore.get("user_id")?.value;
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const athlete = await prisma.athlete.findUnique({ where: { userId } });
  if (!athlete) return NextResponse.json({ error: "Atleta não encontrado" }, { status: 404 });

  const upserted: string[] = [];

  // Running PRs — Riegel estimation across all running activities
  const runActivities = await prisma.activity.findMany({
    where: { athleteId: athlete.id, sport: "RUNNING", distance: { not: null }, duration: { not: null } },
    select: { id: true, distance: true, duration: true, date: true },
  });

  for (const std of STANDARD_DISTANCES) {
    const candidates: { timeSeconds: number; activityId: string; date: Date }[] = [];

    for (const act of runActivities) {
      const dist = act.distance!;
      const dur = act.duration!;
      const speedKmh = (dist / 1000) / (dur / 3600);
      if (speedKmh < 5 || speedKmh > 25) continue;
      candidates.push({ timeSeconds: riegelTime(dist, dur, std.meters), activityId: act.id, date: act.date });
    }

    if (candidates.length === 0) continue;
    candidates.sort((a, b) => a.timeSeconds - b.timeSeconds);
    const best = candidates[0];
    await upsertRecord(athlete.id, std.meters, std.name, best.timeSeconds, best.timeSeconds / (std.meters / 1000), best.activityId, best.date, upserted);
  }

  // Triathlon PRs — use actual total time from triathlon activities
  const triActivities = await prisma.activity.findMany({
    where: { athleteId: athlete.id, sport: { in: TRIATHLON_SPORTS }, duration: { not: null } },
    select: { id: true, sport: true, distance: true, duration: true, date: true },
  });

  const sportToDistance: Record<string, typeof TRIATHLON_DISTANCES[0]> = {
    TRIATHLON_SPRINT: TRIATHLON_DISTANCES[0],
    TRIATHLON_OLYMPIC: TRIATHLON_DISTANCES[1],
    TRIATHLON_HALF: TRIATHLON_DISTANCES[2],
    TRIATHLON_FULL: TRIATHLON_DISTANCES[3],
  };

  for (const [sport, triDist] of Object.entries(sportToDistance)) {
    const matching = triActivities.filter(a => a.sport === sport);
    if (matching.length === 0) continue;
    matching.sort((a, b) => a.duration! - b.duration!);
    const best = matching[0];
    const paceSecPerKm = best.duration! / (triDist.totalMeters / 1000);
    await upsertRecord(athlete.id, triDist.totalMeters, triDist.name, best.duration!, paceSecPerKm, best.id, best.date, upserted);
  }

  return NextResponse.json({ updated: upserted });
}
