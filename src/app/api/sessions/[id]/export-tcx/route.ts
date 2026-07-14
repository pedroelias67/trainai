export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

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

function buildStep(
  id: number,
  name: string,
  durationSecs: number,
  intensity: "Warmup" | "Active" | "Cooldown",
  speedLow?: number,
  speedHigh?: number
): string {
  const target =
    speedLow && speedHigh
      ? `<Target xsi:type="Speed_t">
          <LowInMetersPerSecond>${speedLow.toFixed(3)}</LowInMetersPerSecond>
          <HighInMetersPerSecond>${speedHigh.toFixed(3)}</HighInMetersPerSecond>
        </Target>`
      : `<Target xsi:type="NullTarget_t"/>`;

  return `    <Step xsi:type="Step_t">
      <StepId>${id}</StepId>
      <Name>${name}</Name>
      <Duration xsi:type="Time_t">
        <Seconds>${Math.round(durationSecs)}</Seconds>
      </Duration>
      <Intensity>${intensity}</Intensity>
      ${target}
    </Step>`;
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

  const totalDuration = (session.plannedDuration ?? 45) * 60; // convert min to sec
  const warmupSecs = totalDuration * 0.15;
  const cooldownSecs = totalDuration * 0.1;
  const mainSecs = totalDuration - warmupSecs - cooldownSecs;

  const speedMs = paceToMetersPerSecond(session.plannedPace ?? null);
  const speedLow = speedMs ? speedMs * 0.95 : undefined;
  const speedHigh = speedMs ? speedMs * 1.05 : undefined;

  const steps: string[] = [];
  let stepId = 1;

  if (session.warmup) {
    steps.push(buildStep(stepId++, "Aquecimento", warmupSecs, "Warmup"));
  }

  steps.push(buildStep(stepId++, session.name, mainSecs, "Active", speedLow, speedHigh));

  if (session.cooldown) {
    steps.push(buildStep(stepId++, "Arrefecimento", cooldownSecs, "Cooldown"));
  }

  const tcx = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<TrainingCenterDatabase
  xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd">
  <Workouts>
    <Workout Sport="${sportToTcx(session.sport)}">
      <Name>${session.name}</Name>
${steps.join("\n")}
      <ScheduledOn>${new Date(session.date).toISOString().split("T")[0]}</ScheduledOn>
      <Notes>${[session.shortDescription, session.mainSet, session.coachTip].filter(Boolean).join(" | ")}</Notes>
    </Workout>
  </Workouts>
</TrainingCenterDatabase>`;

  const filename = `trainai-${session.name.toLowerCase().replace(/\s+/g, "-")}.tcx`;
  const bytes = new TextEncoder().encode(tcx);

  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "application/vnd.garmin.tcx+xml",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
