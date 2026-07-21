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
  const match = pace.match(/^(\d+):(\d+)$/);
  if (!match) return null;
  const totalSeconds = parseInt(match[1]) * 60 + parseInt(match[2]);
  return 1000 / totalSeconds;
}

// Generate synthetic trackpoints to represent a workout
// Strava requires at least a start + end trackpoint with timestamps and distance
function generateTrackpoints(
  startTime: Date,
  durationSecs: number,
  distanceMeters: number | null,
  speedMps: number | null,
  heartRate: number | null
): string {
  const points: string[] = [];
  // Generate a trackpoint every 60 seconds
  const intervalSecs = 60;
  const totalPoints = Math.max(2, Math.ceil(durationSecs / intervalSecs) + 1);
  const effectiveSpeed = speedMps ?? (distanceMeters ? distanceMeters / durationSecs : null);

  for (let i = 0; i < totalPoints; i++) {
    const offsetSecs = Math.min(i * intervalSecs, durationSecs);
    const t = new Date(startTime.getTime() + offsetSecs * 1000);
    const dist = effectiveSpeed ? effectiveSpeed * offsetSecs : (distanceMeters ? (distanceMeters * offsetSecs / durationSecs) : null);

    const hrXml = heartRate
      ? `<HeartRateBpm><Value>${heartRate}</Value></HeartRateBpm>`
      : "";
    const distXml = dist != null
      ? `<DistanceMeters>${dist.toFixed(1)}</DistanceMeters>`
      : "";
    const speedXml = effectiveSpeed
      ? `<Extensions><ns3:TPX xmlns:ns3="http://www.garmin.com/xmlschemas/ActivityExtension/v2"><ns3:Speed>${effectiveSpeed.toFixed(2)}</ns3:Speed></ns3:TPX></Extensions>`
      : "";

    points.push(`      <Trackpoint>
        <Time>${t.toISOString()}</Time>
        ${distXml}
        ${hrXml}
        ${speedXml}
      </Trackpoint>`);
  }

  return points.join("\n");
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

  const owned = await prisma.trainingSession.findFirst({
    where: { id, week: { plan: { athleteId: athlete.id } } },
    include: { week: true },
  });
  if (!owned) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const session = owned;
  const durationSecs = (session.plannedDuration ?? 45) * 60;
  const distanceMeters = session.plannedDistance ? session.plannedDistance * 1000 : null;
  const speedMps = paceToMetersPerSecond(session.plannedPace ?? null);

  // Use session date at 08:00 local time as start time
  const sessionDate = new Date(session.date);
  const startTime = new Date(
    sessionDate.getFullYear(),
    sessionDate.getMonth(),
    sessionDate.getDate(),
    8, 0, 0
  );
  const endTime = new Date(startTime.getTime() + durationSecs * 1000);

  const sport = sportToTcx(session.sport);
  const notes = escapeXml(
    [session.shortDescription, session.coachTip].filter(Boolean).join(" — ")
  );
  const trackpoints = generateTrackpoints(startTime, durationSecs, distanceMeters, speedMps, null);

  const tcx = `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase
  xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd">
  <Activities>
    <Activity Sport="${sport}">
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

  const safeName = session.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const filename = `trainai-${safeName}.tcx`;
  const buffer = Buffer.from(tcx, "utf-8");

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": buffer.byteLength.toString(),
    },
  });
}
