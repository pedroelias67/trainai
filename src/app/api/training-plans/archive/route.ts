export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PlanStatus } from "@prisma/client";
import { getSessionUserId } from "@/lib/session";
import { removePlanFromWatch } from "@/lib/watch-sync";

export async function POST() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const athlete = await prisma.athlete.findUnique({ where: { userId } });
  if (!athlete) return NextResponse.json({ error: "Atleta não encontrado" }, { status: 404 });

  const active = await prisma.trainingPlan.findMany({
    where: { athleteId: athlete.id, status: "ACTIVE" },
    select: { id: true },
  });

  await prisma.trainingPlan.updateMany({
    where: { athleteId: athlete.id, status: "ACTIVE" },
    data: { status: PlanStatus.ARCHIVED },
  });

  // An archived plan's workouts have no business staying on the watch.
  for (const plan of active) await removePlanFromWatch(athlete.id, plan.id);

  return NextResponse.json({ ok: true });
}
