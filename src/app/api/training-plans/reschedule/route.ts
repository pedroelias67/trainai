export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { reschedulePlan } from "@/lib/reschedule";

// Everything the preferences form holds, not just the days: saving only part of
// a form the athlete filled in loses the rest without saying so.
const schema = z.object({
  preferredDays: z.array(z.number().int().min(1).max(7)).min(2),
  longRunDay: z.number().int().min(1).max(7),
  weeklyHours: z.number().positive().max(40).optional(),
  fitnessLevel: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED", "ELITE"]).optional(),
});

/**
 * Moves the rest of the active plan on to different days.
 *
 * The alternative was regenerating: the plan archived and rewritten from today
 * as if the athlete were starting over, losing the progression they had built
 * to answer a question about the calendar.
 */
export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Escolhe pelo menos dois dias de treino" }, { status: 400 });
  }
  const { preferredDays, longRunDay, weeklyHours, fitnessLevel } = parsed.data;

  const athlete = await prisma.athlete.findUnique({
    where: { userId },
    select: { id: true, trainingPlans: { where: { status: "ACTIVE" }, select: { id: true }, take: 1 } },
  });
  if (!athlete) return NextResponse.json({ error: "Atleta não encontrado" }, { status: 404 });

  const plan = athlete.trainingPlans[0];
  if (!plan) return NextResponse.json({ error: "Sem plano ativo para reagendar" }, { status: 400 });

  await prisma.athlete.update({
    where: { id: athlete.id },
    data: {
      preferredDays, longRunDay, trainingDaysPerWeek: preferredDays.length,
      ...(weeklyHours !== undefined ? { weeklyHours } : {}),
      ...(fitnessLevel !== undefined ? { fitnessLevel } : {}),
    },
  });

  const result = await reschedulePlan(athlete.id, plan.id, preferredDays, longRunDay);
  return NextResponse.json({ ok: true, ...result });
}
