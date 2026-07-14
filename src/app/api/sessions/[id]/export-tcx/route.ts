export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

function escapeXml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function sportToTcx(sport: string): string {
  if (sport === "CYCLING") return "Biking";
  if (sport === "SWIMMING") return "Other";
  return "Running";
}

function paceToMetersPerSecond(pace: string | null): number | null {
  if (!pace) return null;
  // pace format: "5:30" (min:sec per km)
  const match = pace.match(/^(\d+):(\d+)$/);
  if (!match) return null;
  const totalSeconds = parseInt(match[1]) * 60 + parseInt(match[2]);
  return 1000 / totalSeconds;
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
  const session = await prisma.trainingSession.findUnique({
    where: { id },
    include: { week: true },
  });

  if (!session) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const owned = await prisma.trainingSession.findFirst({
    where: { id, week: { plan: { athleteId: athlete.id } } },
  });
  if (!owned) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const totalDurationSecs = (session.plannedDuration ?? 45) * 60;
  const distanceMeters = session.plannedDistance ? session.plannedDistance * 1000 : 0;
  const startTime = new Date(session.date);
  startTime.setHours(8, 0, 0, 0);
  const startIso = startTime.toISOString();

  const notes = escapeXml(
    [session.name, session.shortDescription, session.coachTip]
      .filter(Boolean).join(" — ")
  );

  const tcx = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<TrainingCenterDatabase
  xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd">
  <Activities>
    <Activity Sport="${sportToTcx(session.sport)}">
      <Id>${startIso}</Id>
      <Lap StartTime="${startIso}">
        <TotalTimeSeconds>${Math.round(totalDurationSecs)}</TotalTimeSeconds>
        <DistanceMeters>${Math.round(distanceMeters)}</DistanceMeters>
        <Calories>0</Calories>
        <Intensity>Active</Intensity>
        <TriggerMethod>Manual</TriggerMethod>
        <Track>
          <Trackpoint>
            <Time>${startIso}</Time>
          </Trackpoint>
        </Track>
      </Lap>
      <Notes>${notes}</Notes>
    </Activity>
  </Activities>
</TrainingCenterDatabase>`;

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
