export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { buildTcxWorkout } from "@/lib/tcx-builder";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  const userId = cookieStore.get("user_id")?.value;
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const athlete = await prisma.athlete.findUnique({ where: { userId } });
  if (!athlete) return NextResponse.json({ error: "Atleta não encontrado" }, { status: 404 });

  const { id } = await params;
  const session = await prisma.trainingSession.findFirst({
    where: { id, week: { plan: { athleteId: athlete.id } } },
  });
  if (!session) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const tcx = buildTcxWorkout({
    name: session.name,
    date: session.date,
    sport: session.sport,
    sessionType: session.sessionType,
    plannedDuration: session.plannedDuration,
    plannedDistance: session.plannedDistance,
    plannedPace: session.plannedPace,
    shortDescription: session.shortDescription,
    coachTip: session.coachTip,
    athleteMaxHR: athlete.maxHR,
  });

  const filename = `trainai-${session.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.tcx`;
  const buffer = Buffer.from(tcx, "utf-8");

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": buffer.byteLength.toString(),
    },
  });
}
