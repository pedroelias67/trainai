export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { z } from "zod";
import { Sport, Distance, GoalType, Priority } from "@prisma/client";

// Nothing was validated here: an unparseable date reached Prisma as Invalid Date
// and surfaced as a generic 500, a past date was stored and counted down to a
// negative number on the dashboard, and a bad enum failed the same opaque way.
// No upper bound on how far ahead an event may be — that is deliberate.
const eventSchema = z.object({
  name: z.string().trim().min(2, "O nome do evento é demasiado curto").max(120),
  sport: z.nativeEnum(Sport, { errorMap: () => ({ message: "Modalidade inválida" }) }),
  distance: z.nativeEnum(Distance, { errorMap: () => ({ message: "Distância inválida" }) }),
  date: z
    .string()
    .refine(v => !Number.isNaN(Date.parse(v)), "Data inválida")
    .refine(v => Date.parse(v) > Date.now(), "A data do evento já passou"),
  goalType: z.nativeEnum(GoalType, { errorMap: () => ({ message: "Tipo de objetivo inválido" }) }),
  goalTime: z
    .string()
    .regex(/^\d{1,2}:\d{2}(:\d{2})?$/, "Tempo alvo deve ser no formato H:MM:SS ou MM:SS")
    .optional()
    .or(z.literal("")),
  priority: z.nativeEnum(Priority).optional(),
});

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const userId = cookieStore.get("user_id")?.value;
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    const parsed = eventSchema.safeParse(await req.json());
    if (!parsed.success) {
      // Surface the first specific message rather than a blanket "invalid data".
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados do evento inválidos" },
        { status: 400 }
      );
    }
    const body = parsed.data;

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
