import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const userId = cookieStore.get("user_id")?.value;
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    const body = await req.json();

    const athlete = await prisma.athlete.findUnique({ where: { userId } });
    if (!athlete) return NextResponse.json({ error: "Atleta não encontrado" }, { status: 404 });

    const event = await prisma.event.create({
      data: {
        athleteId: athlete.id,
        name: body.name,
        sport: body.sport,
        distance: body.distance,
        date: new Date(body.date),
        goalType: body.goalType,
        goalTime: body.goalTime || null,
        priority: body.priority ?? "A",
      },
    });

    return NextResponse.json(event, { status: 201 });
  } catch (err) {
    console.error("Event creation error:", err);
    return NextResponse.json({ error: "Erro ao criar evento" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const userId = cookieStore.get("user_id")?.value;
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const athlete = await prisma.athlete.findUnique({ where: { userId } });
  if (!athlete) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const events = await prisma.event.findMany({
    where: { athleteId: athlete.id },
    orderBy: { date: "asc" },
  });

  return NextResponse.json(events);
}
