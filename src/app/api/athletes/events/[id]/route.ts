export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
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
  const agora = new Date();

  let removidas = 0;
  const semanas = new Set<string>();
  try {
    const sessoes = await prisma.trainingSession.findMany({
      where: {
        sessionType: "RACE",
        date: { gte: inicio > agora ? inicio : agora, lte: fim },
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
  }

  await prisma.event.delete({ where: { id } });

  for (const weekId of semanas) await sendWeekToWatch(athlete.id, weekId);

  return NextResponse.json({ ok: true, removedSessions: removidas });
}
