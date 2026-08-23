export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { recalculatePersonalRecords } from "@/lib/personal-records";

export async function GET() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("user_id")?.value;
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const athlete = await prisma.athlete.findUnique({ where: { userId }, select: { id: true } });
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

  const athlete = await prisma.athlete.findUnique({ where: { userId }, select: { id: true } });
  if (!athlete) return NextResponse.json({ error: "Atleta não encontrado" }, { status: 404 });

  const updated = await recalculatePersonalRecords(athlete.id);
  return NextResponse.json({ updated });
}
