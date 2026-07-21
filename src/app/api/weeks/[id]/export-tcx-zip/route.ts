export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import JSZip from "jszip";

function escapeXml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function sportToTcx(sport: string): string {
  if (sport === "CYCLING") return "Biking";
  if (sport === "SWIMMING") return "Other";
  return "Running";
}

function paceToMetersPerSecond(pace: string | null | undefined): number | null {
  if (!pace) return null;
  const match = pace.match(/^(\d+):(\d+)$/);
  if (!match) return null;
  const totalSecs = parseInt(match[1]) * 60 + parseInt(match[2]);
  return 1000 / totalSecs;
}

function paceTarget(mps: number, tol = 0.15): string {
  return `xsi:type="Speed_t"><Low>${(mps - tol).toFixed(3)}</Low><High>${(mps + tol).toFixed(3)}</High>`;
}

function buildSteps(session: {
  sessionType: string;
  plannedDuration: number | null;
  plannedDistance: number | null;
  plannedPace: string | null;
  shortDescription: string | null;
  coachTip: string | null;
}): string {
  const totalDurationSecs = (session.plannedDuration ?? 45) * 60;
  const speedMps = paceToMetersPerSecond(session.plannedPace);
  const easyMps = 1000 / (7 * 60);
  const warmupSecs = 10 * 60;
  const cooldownSecs = 10 * 60;
  const mainSecs = Math.max(totalDurationSecs - warmupSecs - cooldownSecs, totalDurationSecs * 0.6);
  let stepId = 1;
  const steps: string[] = [];

  const timeStep = (label: string, secs: number, intensity: string, target: string) =>
    `<Step xsi:type="Step_t">
        <StepId>${stepId++}</StepId>
        <Name>${escapeXml(label)}</Name>
        <Duration xsi:type="Time_t"><Seconds>${Math.round(secs)}</Seconds></Duration>
        <Intensity>${intensity}</Intensity>
        <Target ${target || 'xsi:type="NullTarget_t"'}>${target ? "" : ""}</Target>
      </Step>`;

  const distStep = (label: string, meters: number, intensity: string, target: string) =>
    `<Step xsi:type="Step_t">
        <StepId>${stepId++}</StepId>
        <Name>${escapeXml(label)}</Name>
        <Duration xsi:type="Distance_t"><Meters>${Math.round(meters)}</Meters></Duration>
        <Intensity>${intensity}</Intensity>
        <Target ${target || 'xsi:type="NullTarget_t"'}>${target ? "" : ""}</Target>
      </Step>`;

  switch (session.sessionType) {
    case "EASY":
    case "RECOVERY":
    case "LONG": {
      const mainMeters = session.plannedDistance ? session.plannedDistance * 1000 : null;
      const t = speedMps ? paceTarget(speedMps) : "";
      if (mainMeters) {
        steps.push(distStep("Aquecimento", 1000, "Warmup", paceTarget(easyMps)));
        steps.push(distStep(session.sessionType === "LONG" ? "Longo" : "Corrida fácil", mainMeters - 2000, "Active", t));
        steps.push(distStep("Retorno à calma", 1000, "Cooldown", paceTarget(easyMps)));
      } else {
        steps.push(timeStep("Aquecimento", warmupSecs, "Warmup", paceTarget(easyMps)));
        steps.push(timeStep(session.sessionType === "LONG" ? "Longo" : "Corrida fácil", mainSecs, "Active", t));
        steps.push(timeStep("Retorno à calma", cooldownSecs, "Cooldown", paceTarget(easyMps)));
      }
      break;
    }
    case "TEMPO": {
      const t = speedMps ? paceTarget(speedMps, 0.1) : "";
      steps.push(timeStep("Aquecimento", warmupSecs, "Warmup", paceTarget(easyMps)));
      steps.push(timeStep("Tempo", mainSecs, "Active", t));
      steps.push(timeStep("Retorno à calma", cooldownSecs, "Cooldown", paceTarget(easyMps)));
      break;
    }
    case "INTERVALS": {
      const iMps = speedMps ?? 1000 / (4.5 * 60);
      const repSecs = 4 * 60;
      const recovSecs = 2 * 60;
      const reps = Math.max(4, Math.round(mainSecs / (repSecs + recovSecs)));
      steps.push(timeStep("Aquecimento", warmupSecs, "Warmup", paceTarget(easyMps)));
      steps.push(`<Step xsi:type="Repeat_t">
        <StepId>${stepId++}</StepId>
        <Repetitions>${reps}</Repetitions>
        <Child xsi:type="Step_t">
          <StepId>${stepId++}</StepId>
          <Name>Esforço</Name>
          <Duration xsi:type="Time_t"><Seconds>${repSecs}</Seconds></Duration>
          <Intensity>Active</Intensity>
          <Target ${paceTarget(iMps, 0.1)}></Target>
        </Child>
        <Child xsi:type="Step_t">
          <StepId>${stepId++}</StepId>
          <Name>Recuperação</Name>
          <Duration xsi:type="Time_t"><Seconds>${recovSecs}</Seconds></Duration>
          <Intensity>Rest</Intensity>
          <Target xsi:type="NullTarget_t"/>
        </Child>
      </Step>`);
      steps.push(timeStep("Retorno à calma", cooldownSecs, "Cooldown", paceTarget(easyMps)));
      break;
    }
    default: {
      steps.push(timeStep("Aquecimento", warmupSecs, "Warmup", ""));
      steps.push(timeStep("Principal", mainSecs, "Active", speedMps ? paceTarget(speedMps) : ""));
      steps.push(timeStep("Retorno à calma", cooldownSecs, "Cooldown", ""));
    }
  }

  return steps.join("\n      ");
}

function sessionToTcx(session: {
  name: string;
  sport: string;
  date: Date;
  sessionType: string;
  plannedDuration: number | null;
  plannedDistance: number | null;
  plannedPace: string | null;
  shortDescription: string | null;
  coachTip: string | null;
}): string {
  const scheduledOn = session.date.toISOString().split("T")[0];
  const notes = escapeXml([session.shortDescription, session.coachTip].filter(Boolean).join(" — "));
  const stepsXml = buildSteps(session);

  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<TrainingCenterDatabase
  xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd">
  <Workouts>
    <Workout Sport="${sportToTcx(session.sport)}">
      <Name>${escapeXml(session.name)}</Name>
      ${stepsXml}
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
