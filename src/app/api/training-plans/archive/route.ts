export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PlanStatus } from "@prisma/client";
import { getSessionUserId } from "@/lib/session";

export async function POST() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const athlete = await prisma.athlete.findUnique({ where: { userId } });
  if (!athlete) return NextResponse.json({ error: "Atleta não encontrado" }, { status: 404 });

  await prisma.trainingPlan.updateMany({
    where: { athleteId: athlete.id, status: "ACTIVE" },
    data: { status: PlanStatus.ARCHIVED },
  });

  return NextResponse.json({ ok: true });
}
