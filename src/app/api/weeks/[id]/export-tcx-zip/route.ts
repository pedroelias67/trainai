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

function paceToMetersPerSecond(pace: string | null | undefined): number | null {
  if (!pace) return null;
  const match = pace.match(/^(\d+):(\d+)$/);
  if (!match) return null;
  const totalSeconds = parseInt(match[1]) * 60 + parseInt(match[2]);
  return 1000 / totalSeconds;
}

function generateTrackpoints(startTime: Date, durationSecs: number, distanceMeters: number | null, speedMps: number | null): string {
  const points: string[] = [];
  const intervalSecs = 60;
  const totalPoints = Math.max(2, Math.ceil(durationSecs / intervalSecs) + 1);
  const effectiveSpeed = speedMps ?? (distanceMeters ? distanceMeters / durationSecs : null);

  for (let i = 0; i < totalPoints; i++) {
    const offsetSecs = Math.min(i * intervalSecs, durationSecs);
    const t = new Date(startTime.getTime() + offsetSecs * 1000);
    const dist = effectiveSpeed ? effectiveSpeed * offsetSecs : (distanceMeters ? distanceMeters * offsetSecs / durationSecs : null);
    points.push(`        <Trackpoint>
          <Time>${t.toISOString()}</Time>
          ${dist != null ? `<DistanceMeters>${dist.toFixed(1)}</DistanceMeters>` : ""}
        </Trackpoint>`);
  }
  return points.join("\n");
}

function sessionToTcx(session: {
  name: string;
  sport: string;
  date: Date;
  plannedDuration: number | null;
  plannedDistance: number | null;
  plannedPace: string | null;
  shortDescription: string | null;
  coachTip: string | null;
}): string {
  const durationSecs = (session.plannedDuration ?? 45) * 60;
  const distanceMeters = session.plannedDistance ? session.plannedDistance * 1000 : null;
  const speedMps = paceToMetersPerSecond(session.plannedPace);
  const sessionDate = new Date(session.date);
  const startTime = new Date(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate(), 8, 0, 0);
  const notes = escapeXml([session.shortDescription, session.coachTip].filter(Boolean).join(" — "));
  const trackpoints = generateTrackpoints(startTime, durationSecs, distanceMeters, speedMps);

  return `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase
  xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd">
  <Activities>
    <Activity Sport="${sportToTcx(session.sport)}">
      <Id>${startTime.toISOString()}</Id>
      <Lap StartTime="${startTime.toISOString()}">
        <TotalTimeSeconds>${Math.round(durationSecs)}</TotalTimeSeconds>
        ${distanceMeters != null ? `<DistanceMeters>${distanceMeters.toFixed(1)}</DistanceMeters>` : ""}
        <Intensity>Active</Intensity>
        <TriggerMethod>Manual</TriggerMethod>
        <Track>
${trackpoints}
        </Track>
        <Notes>${notes}</Notes>
      </Lap>
      <Creator xsi:type="Device_t">
        <Name>TrainAI</Name>
      </Creator>
    </Activity>
  </Activities>
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
