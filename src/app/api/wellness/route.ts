export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { startOfDay } from "date-fns";
import { getSessionUserId } from "@/lib/session";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const athlete = await prisma.athlete.findUnique({ where: { userId } });
  if (!athlete) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const today = startOfDay(new Date());
  const log = await prisma.wellnessLog.findUnique({
    where: { athleteId_date: { athleteId: athlete.id, date: today } },
  });

  return NextResponse.json({ log });
}

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const athlete = await prisma.athlete.findUnique({ where: { userId } });
  if (!athlete) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const body = await req.json();
  const { sleepQuality, fatigue, mood, musclesSore, rpe, notes } = body;

  const today = startOfDay(new Date());
  const log = await prisma.wellnessLog.upsert({
    where: { athleteId_date: { athleteId: athlete.id, date: today } },
    create: { athleteId: athlete.id, date: today, sleepQuality, fatigue, mood, musclesSore, rpe, notes },
    update: { sleepQuality, fatigue, mood, musclesSore, rpe, notes },
  });

  return NextResponse.json({ log });
}
