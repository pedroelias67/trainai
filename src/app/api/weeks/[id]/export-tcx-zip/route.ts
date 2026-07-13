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

function paceToMetersPerSecond(pace: string | null): number | null {
  if (!pace) return null;
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

function sessionToTcx(session: {
  name: string;
  sport: string;
  date: Date;
  plannedDuration: number | null;
  plannedPace: string | null;
  warmup: string | null;
  cooldown: string | null;
  shortDescription: string | null;
  mainSet: string | null;
  coachTip: string | null;
}): string {
  const totalDuration = (session.plannedDuration ?? 45) * 60;
  const warmupSecs = totalDuration * 0.15;
  const cooldownSecs = totalDuration * 0.1;
  const mainSecs = totalDuration - warmupSecs - cooldownSecs;

  const speedMs = paceToMetersPerSecond(session.plannedPace);
  const speedLow = speedMs ? speedMs * 0.95 : undefined;
  const speedHigh = speedMs ? speedMs * 1.05 : undefined;

  const steps: string[] = [];
  let stepId = 1;
  if (session.warmup) steps.push(buildStep(stepId++, "Aquecimento", warmupSecs, "Warmup"));
  steps.push(buildStep(stepId++, session.name, mainSecs, "Active", speedLow, speedHigh));
  if (session.cooldown) steps.push(buildStep(stepId++, "Arrefecimento", cooldownSecs, "Cooldown"));

  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<TrainingCenterDatabase
  xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd">
  <Workouts>
    <Workout Sport="${sportToTcx(session.sport)}">
      <Name>${session.name}</Name>
${steps.join("\n")}
      <ScheduledOn>${session.date.toISOString().split("T")[0]}</ScheduledOn>
      <Notes>${[session.shortDescription, session.mainSet, session.coachTip].filter(Boolean).join(" | ")}</Notes>
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
