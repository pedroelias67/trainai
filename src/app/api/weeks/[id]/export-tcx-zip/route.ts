export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import JSZip from "jszip";

function sportToTcx(sport: string): string {
  if (sport === "CYCLING") return "Biking";
  if (sport === "SWIMMING") return "Other";
  return "Running";
}

function escapeXml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function sessionToTcx(session: {
  name: string;
  sport: string;
  date: Date;
  plannedDuration: number | null;
  shortDescription: string | null;
  coachTip: string | null;
}): string {
  const totalDurationSecs = (session.plannedDuration ?? 45) * 60;
  const scheduledOn = session.date.toISOString().split("T")[0];
  const notes = escapeXml([session.shortDescription, session.coachTip].filter(Boolean).join(" — "));

  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<TrainingCenterDatabase
  xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd">
  <Workouts>
    <Workout Sport="${sportToTcx(session.sport)}">
      <Name>${escapeXml(session.name)}</Name>
      <Step xsi:type="Step_t">
        <StepId>1</StepId>
        <Duration xsi:type="Time_t">
          <Seconds>${Math.round(totalDurationSecs)}</Seconds>
        </Duration>
        <Intensity>Active</Intensity>
        <Target xsi:type="NullTarget_t"/>
      </Step>
      <ScheduledOn>${scheduledOn}</ScheduledOn>
      <Notes>${notes}</Notes>
    </Workout>
  </Workouts>
</TrainingCenterDatabase>`;
}

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
          plannedDuration: true,
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
    const tcx = sessionToTcx(session);
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
