import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function PUT(req: NextRequest) {
  const cookieStore = await cookies();
  const userId = cookieStore.get("user_id")?.value;
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    const body = await req.json();

    const athlete = await prisma.athlete.update({
      where: { userId },
      data: {
        ...(body.dateOfBirth && { dateOfBirth: new Date(body.dateOfBirth) }),
        ...(body.gender && { gender: body.gender }),
        ...(body.fitnessLevel && { fitnessLevel: body.fitnessLevel }),
        ...(body.weeklyHours != null && { weeklyHours: Number(body.weeklyHours) }),
        ...(body.trainingDaysPerWeek != null && { trainingDaysPerWeek: Number(body.trainingDaysPerWeek) }),
        ...(body.longRunDay != null && { longRunDay: Number(body.longRunDay) }),
        ...(body.restingHR != null && { restingHR: Number(body.restingHR) }),
        ...(body.maxHR != null && { maxHR: Number(body.maxHR) }),
        ...(body.ltPace && { ltPace: body.ltPace }),
        ...(body.ftp != null && { ftp: Number(body.ftp) }),
      },
    });

    return NextResponse.json(athlete);
  } catch (err: any) {
    console.error("Profile update error:", JSON.stringify(err?.message ?? err));
    return NextResponse.json({ error: err?.message ?? "Erro ao atualizar perfil" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const userId = cookieStore.get("user_id")?.value;
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const athlete = await prisma.athlete.findUnique({
    where: { userId },
    include: { user: true, events: true },
  });

  if (!athlete) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  return NextResponse.json(athlete);
}
