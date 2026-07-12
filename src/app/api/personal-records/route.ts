export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const STANDARD_DISTANCES = [
  { name: "5 km", meters: 5000, minM: 4500, maxM: 5500 },
  { name: "10 km", meters: 10000, minM: 9000, maxM: 11000 },
  { name: "Meia Maratona", meters: 21097, minM: 20000, maxM: 22200 },
  { name: "Maratona", meters: 42195, minM: 40000, maxM: 44400 },
];

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

export async function POST(_req: NextRequest) {
  const cookieStore = await cookies();
  const userId = cookieStore.get("user_id")?.value;
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const athlete = await prisma.athlete.findUnique({ where: { userId } });
  if (!athlete) return NextResponse.json({ error: "Atleta não encontrado" }, { status: 404 });

  // Get all running activities with distance and duration
  const activities = await prisma.activity.findMany({
    where: {
      athleteId: athlete.id,
      sport: "RUNNING",
      distance: { not: null },
      duration: { not: null },
    },
    select: { id: true, distance: true, duration: true, date: true },
  });

  const upserted = [];

  for (const std of STANDARD_DISTANCES) {
    // Find activities in exact range for this distance
    const exactActivities = activities.filter(
      (a) => a.distance! >= std.minM && a.distance! <= std.maxM
    );

    // Also estimate via Riegel for all running activities
    const candidates: { timeSeconds: number; activityId: string; date: Date }[] = [];

    for (const act of activities) {
      const dist = act.distance!;
      const dur = act.duration!;
      const speedKmh = (dist / 1000) / (dur / 3600);
      // Skip unrealistic paces
      if (speedKmh < 5 || speedKmh > 25) continue;

      if (exactActivities.includes(act)) {
        // Use actual time, adjusted for standard distance
        const adjustedTime = riegelTime(dist, dur, std.meters);
        candidates.push({ timeSeconds: adjustedTime, activityId: act.id, date: act.date });
      } else {
        // Use Riegel to estimate
        const estimatedTime = riegelTime(dist, dur, std.meters);
        candidates.push({ timeSeconds: estimatedTime, activityId: act.id, date: act.date });
      }
    }

    if (candidates.length === 0) continue;

    // Find best (minimum time)
    candidates.sort((a, b) => a.timeSeconds - b.timeSeconds);
    const best = candidates[0];

    const paceSecPerKm = best.timeSeconds / (std.meters / 1000);

    const existing = await prisma.personalRecord.findFirst({
      where: { athleteId: athlete.id, distance: std.meters },
      select: { id: true },
    });

    if (existing) {
      await prisma.personalRecord.update({
        where: { id: existing.id },
        data: {
          timeSeconds: best.timeSeconds,
          pace: formatPace(paceSecPerKm),
          date: best.date,
          activityId: best.activityId,
        },
      });
    } else {
      await prisma.personalRecord.create({
        data: {
          athleteId: athlete.id,
          distance: std.meters,
          timeSeconds: best.timeSeconds,
          pace: formatPace(paceSecPerKm),
          date: best.date,
          activityId: best.activityId,
        },
      });
    }

    upserted.push(std.name);
  }

  return NextResponse.json({ updated: upserted });
}
