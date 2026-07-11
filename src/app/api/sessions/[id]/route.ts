export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const userId = cookieStore.get("user_id")?.value;
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const athlete = await prisma.athlete.findUnique({ where: { userId } });
  if (!athlete) return NextResponse.json({ error: "Atleta não encontrado" }, { status: 404 });

  const { id } = await params;
  const session = await prisma.trainingSession.findUnique({
    where: { id },
    include: { week: { include: { plan: true } } },
  });

  if (!session || session.week.plan.athleteId !== athlete.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};

  // Move to a different day within the same week
  if (body.dayOfWeek != null) {
    const newDayOfWeek = Number(body.dayOfWeek); // 1=Mon … 7=Sun
    // Recalculate date from week start (Monday)
    const weekStart = new Date(session.week.startDate);
    const newDate = new Date(weekStart);
    newDate.setDate(weekStart.getDate() + newDayOfWeek - 1);
    data.dayOfWeek = newDayOfWeek;
    data.date = newDate;
  }

  if (body.plannedDistance != null) data.plannedDistance = Number(body.plannedDistance);

  const updated = await prisma.trainingSession.update({ where: { id }, data });
  return NextResponse.json(updated);
}
