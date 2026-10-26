export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { z } from "zod";
import { GoalType } from "@prisma/client";
import { sendWeekToWatch } from "@/lib/watch-sync";
import * as Sentry from "@sentry/nextjs";

/**
 * Removes a race from the diary.
 *
 * A race the athlete is no longer running must not keep sitting in the plan, or
 * on the watch, as a session to be run. What it eased around it is left eased:
 * there is no record of which rest day was its doing, and a slightly lighter
 * week is harmless — Sunday's adaptation picks it up from there.
 *
 * The race a plan is built for cannot be removed this way. Deleting it would
 * leave the plan pointing at nothing; archiving the plan is the way to let it go.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;

  const athlete = await prisma.athlete.findUnique({ where: { userId }, select: { id: true } });
  if (!athlete) return NextResponse.json({ error: "Atleta não encontrado" }, { status: 404 });

  const event = await prisma.event.findUnique({
    where: { id },
    select: { id: true, athleteId: true, name: true, date: true, _count: { select: { trainingPlans: true } } },
  });
  if (!event || event.athleteId !== athlete.id) {
    return NextResponse.json({ error: "Prova não encontrada" }, { status: 404 });
  }
  if (event._count.trainingPlans > 0) {
    return NextResponse.json(
      { error: "Esta prova é o objetivo de um plano. Arquiva o plano primeiro." },
      { status: 400 }
    );
  }

  // Its session comes out of whatever is still ahead, and off the watch with it.
  const inicio = new Date(event.date);
  inicio.setHours(0, 0, 0, 0);
  const fim = new Date(event.date);
  fim.setHours(23, 59, 59, 999);

  // Its session comes out first, and the race is only forgotten once it has.
  //
  // This used to swallow a failure here and delete the event anyway, which left
  // a race nobody could see in the diary still sitting in the plan and on the
  // watch — with no row left to explain where it came from.
  let removidas = 0;
  const semanas = new Set<string>();
  try {
    const sessoes = await prisma.trainingSession.findMany({
      where: {
        sessionType: "RACE",
        // Not clamped to the future, which depended on the server's own clock
        // and matched nothing on the very day it mattered. A race already run
        // is protected by `completed` instead: that one is history.
        completed: false,
        date: { gte: inicio, lte: fim },
        week: { plan: { athleteId: athlete.id, status: "ACTIVE" } },
      },
      select: { id: true, weekId: true },
    });
    for (const s of sessoes) semanas.add(s.weekId);
    if (sessoes.length > 0) {
      const { count } = await prisma.trainingSession.deleteMany({
        where: { id: { in: sessoes.map(s => s.id) } },
      });
      removidas = count;
    }
  } catch (e) {
    Sentry.captureException(e, { tags: { stage: "event-delete-sessions" }, extra: { eventId: id } });
    return NextResponse.json(
      { error: "Não foi possível retirar a prova do plano, por isso não a apaguei. Tenta outra vez." },
      { status: 502 }
    );
  }

  await prisma.event.delete({ where: { id } });

  for (const weekId of semanas) await sendWeekToWatch(athlete.id, weekId);

  return NextResponse.json({ ok: true, removedSessions: removidas });
}

const objetivoSchema = z.object({
  goalType: z.nativeEnum(GoalType, { errorMap: () => ({ message: "Tipo de objetivo inválido" }) }),
  goalTime: z
    .string()
    .regex(/^\d{1,2}:\d{2}(:\d{2})?$/, "Tempo alvo deve ser no formato H:MM:SS ou MM:SS")
    .optional()
    .or(z.literal("")),
});

/**
 * Changes what the athlete is aiming for in a race.
 *
 * There was no way to change anything about a race once entered. The form that
 * adds one did not ask for a goal at all, so a race created there was stored as
 * "finish" with no target time — and the plan written for it was shaped for
 * finishing. The athlete could not correct it: the race cannot be deleted while
 * a plan points at it, and nothing else could edit it.
 *
 * Only the goal. Moving a race, or changing its distance, means moving the
 * sessions written around it, which is a different piece of work.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  const parsed = objetivoSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400 }
    );
  }
  const { goalType, goalTime } = parsed.data;
  if (goalType === "TIME" && !goalTime) {
    return NextResponse.json({ error: "Indica o tempo que queres fazer" }, { status: 400 });
  }

  const athlete = await prisma.athlete.findUnique({ where: { userId }, select: { id: true } });
  if (!athlete) return NextResponse.json({ error: "Atleta não encontrado" }, { status: 404 });

  const event = await prisma.event.findUnique({
    where: { id },
    select: { athleteId: true, trainingPlans: { where: { status: "ACTIVE" }, select: { id: true }, take: 1 } },
  });
  if (!event || event.athleteId !== athlete.id) {
    return NextResponse.json({ error: "Prova não encontrada" }, { status: 404 });
  }

  await prisma.event.update({
    where: { id },
    data: { goalType, goalTime: goalType === "TIME" ? goalTime || null : null },
  });

  // The plan in force was written for the old goal, and a goal is what the
  // paces are built from. Said rather than done: regenerating is the athlete's
  // decision, and it archives the block they are training.
  return NextResponse.json({
    ok: true,
    planNeedsRegenerating: event.trainingPlans.length > 0,
  });
}
