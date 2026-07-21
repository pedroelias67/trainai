export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import JSZip from "jszip";
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
  const week = await prisma.trainingWeek.findFirst({
    where: { id, plan: { athleteId: athlete.id } },
    include: {
      sessions: {
        where: { cancelled: false },
        orderBy: { date: "asc" },
        select: {
          name: true,
          sport: true,
          date: true,
          sessionType: true,
          plannedDuration: true,
          plannedDistance: true,
          plannedPace: true,
          shortDescription: true,
          coachTip: true,
        },
      },
    },
  });

  if (!week) return NextResponse.json({ error: "Semana não encontrada" }, { status: 404 });

  const zip = new JSZip();
  const folder = zip.folder(`trainai-semana-${week.weekNumber}`)!;

  for (const session of week.sessions) {
    const tcx = buildTcxWorkout({ ...session, athleteMaxHR: athlete.maxHR });
    const safeName = session.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const date = session.date.toISOString().split("T")[0];
    folder.file(`${date}-${safeName}.tcx`, tcx);
  }

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

  return new NextResponse(new Uint8Array(zipBuffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="trainai-semana-${week.weekNumber}.zip"`,
    },
  });
}
