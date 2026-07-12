export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const userId = cookieStore.get("user_id")?.value;
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const athlete = await prisma.athlete.findUnique({ where: { userId } });
  if (!athlete) return NextResponse.json({ error: "Atleta não encontrado" }, { status: 404 });

  const { id: shoeId } = await params;
  const shoe = await prisma.shoe.findUnique({ where: { id: shoeId } });
  if (!shoe || shoe.athleteId !== athlete.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const { activityId } = await req.json();
  if (!activityId) return NextResponse.json({ error: "activityId é obrigatório" }, { status: 400 });

  const activity = await prisma.activity.findUnique({ where: { id: activityId } });
  if (!activity || activity.athleteId !== athlete.id) {
    return NextResponse.json({ error: "Atividade não encontrada" }, { status: 404 });
  }

  // Assign activity to shoe
  await prisma.activity.update({ where: { id: activityId }, data: { shoeId } });

  // Recalculate totalKm for this shoe
  const activities = await prisma.activity.findMany({
    where: { shoeId },
    select: { distance: true },
  });

  const totalKm = activities.reduce((sum, a) => sum + (a.distance ?? 0) / 1000, 0);

  const updatedShoe = await prisma.shoe.update({
    where: { id: shoeId },
    data: { totalKm },
  });

  return NextResponse.json({ shoe: updatedShoe });
}
