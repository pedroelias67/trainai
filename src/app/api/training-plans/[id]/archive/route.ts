import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { removePlanFromWatch } from "@/lib/watch-sync";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;

  const athlete = await prisma.athlete.findUnique({ where: { userId } });
  if (!athlete) return NextResponse.json({ error: "Atleta não encontrado" }, { status: 404 });

  const plan = await prisma.trainingPlan.findUnique({ where: { id } });
  if (!plan || plan.athleteId !== athlete.id) {
    return NextResponse.json({ error: "Plano não encontrado" }, { status: 404 });
  }

  await prisma.trainingPlan.update({
    where: { id },
    data: { status: "ARCHIVED" },
  });

  await removePlanFromWatch(athlete.id, id);

  return NextResponse.json({ ok: true });
}
