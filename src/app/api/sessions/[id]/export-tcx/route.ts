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

function paceToMetersPerSecond(pace: string | null | undefined): number | null {
  if (!pace) return null;
  const match = pace.match(/^(\d+):(\d+)$/);
  if (!match) return null;
  const totalSecs = parseInt(match[1]) * 60 + parseInt(match[2]);
  return 1000 / totalSecs;
}

// Garmin TCX Workout steps — each step shown on the watch during training
function buildSteps(session: {
  sessionType: string;
  plannedDuration: number | null;
  plannedDistance: number | null;
  plannedPace: string | null;
  warmup: string | null;
  mainSet: string | null;
  cooldown: string | null;
}): { xml: string; stepCount: number } {
  const totalDurationSecs = (session.plannedDuration ?? 45) * 60;
  const speedMps = paceToMetersPerSecond(session.plannedPace);
  let stepId = 1;
  const steps: string[] = [];

  function timeStep(label: string, secs: number, intensity: "Warmup" | "Active" | "Cooldown", targetXml: string): string {
    return `<Step xsi:type="Step_t">
        <StepId>${stepId++}</StepId>
        <Name>${escapeXml(label)}</Name>
        <Duration xsi:type="Time_t"><Seconds>${Math.round(secs)}</Seconds></Duration>
        <Intensity>${intensity}</Intensity>
        <Target ${targetXml ? "" : 'xsi:type="NullTarget_t"'}>${targetXml}</Target>
      </Step>`;
  }

  function distanceStep(label: string, meters: number, intensity: "Warmup" | "Active" | "Cooldown", targetXml: string): string {
    return `<Step xsi:type="Step_t">
        <StepId>${stepId++}</StepId>
        <Name>${escapeXml(label)}</Name>
        <Duration xsi:type="Distance_t"><Meters>${Math.round(meters)}</Meters></Duration>
        <Intensity>${intensity}</Intensity>
        <Target ${targetXml ? "" : 'xsi:type="NullTarget_t"'}>${targetXml}</Target>
      </Step>`;
  }

  function paceTarget(mps: number, toleranceMps = 0.15): string {
    return `xsi:type="Speed_t"><Low>${(mps - toleranceMps).toFixed(3)}</Low><High>${(mps + toleranceMps).toFixed(3)}</High>`;
  }

  const warmupSecs = 10 * 60;   // 10 min
  const cooldownSecs = 10 * 60; // 10 min
  const mainSecs = Math.max(totalDurationSecs - warmupSecs - cooldownSecs, totalDurationSecs * 0.6);

  const easyMps = 1000 / (7 * 60); // ~7:00/km easy default

  switch (session.sessionType) {
    case "EASY":
    case "RECOVERY":
    case "LONG": {
      const mainMeters = session.plannedDistance ? session.plannedDistance * 1000 : null;
      const target = speedMps ? paceTarget(speedMps) : "";
      if (mainMeters) {
        steps.push(distanceStep("Aquecimento", 1000, "Warmup", paceTarget(easyMps)));
        steps.push(distanceStep(session.sessionType === "LONG" ? "Longo" : "Corrida fácil", mainMeters - 2000, "Active", target));
        steps.push(distanceStep("Retorno à calma", 1000, "Cooldown", paceTarget(easyMps)));
      } else {
        steps.push(timeStep("Aquecimento", warmupSecs, "Warmup", paceTarget(easyMps)));
        steps.push(timeStep(session.sessionType === "LONG" ? "Longo" : "Corrida fácil", mainSecs, "Active", target));
        steps.push(timeStep("Retorno à calma", cooldownSecs, "Cooldown", paceTarget(easyMps)));
      }
      break;
    }

    case "TEMPO": {
      const tempoMps = speedMps ?? 1000 / (5 * 60);
      steps.push(timeStep("Aquecimento", warmupSecs, "Warmup", paceTarget(easyMps)));
      steps.push(timeStep("Tempo", mainSecs, "Active", paceTarget(tempoMps, 0.1)));
      steps.push(timeStep("Retorno à calma", cooldownSecs, "Cooldown", paceTarget(easyMps)));
      break;
    }

    case "INTERVALS": {
      const intervalMps = speedMps ?? 1000 / (4.5 * 60);
      const repDurationSecs = 4 * 60;   // 4 min interval
      const recovSecs = 2 * 60;          // 2 min recovery
      const reps = Math.max(4, Math.round(mainSecs / (repDurationSecs + recovSecs)));

      steps.push(timeStep("Aquecimento", warmupSecs, "Warmup", paceTarget(easyMps)));

      // Repeat block
      const repeatSteps: string[] = [];
      const repId1 = stepId;
      repeatSteps.push(`<Step xsi:type="Step_t">
        <StepId>${stepId++}</StepId>
        <Name>Esforço</Name>
        <Duration xsi:type="Time_t"><Seconds>${repDurationSecs}</Seconds></Duration>
        <Intensity>Active</Intensity>
        <Target ${paceTarget(intervalMps, 0.1)}></Target>
      </Step>`);
      const repId2 = stepId;
      repeatSteps.push(`<Step xsi:type="Step_t">
        <StepId>${stepId++}</StepId>
        <Name>Recuperação</Name>
        <Duration xsi:type="Time_t"><Seconds>${recovSecs}</Seconds></Duration>
        <Intensity>Rest</Intensity>
        <Target xsi:type="NullTarget_t"/>
      </Step>`);

      steps.push(`<Step xsi:type="Repeat_t">
        <StepId>${stepId++}</StepId>
        <Repetitions>${reps}</Repetitions>
        <Child xsi:type="Step_t">
          <StepId>${repId1}</StepId>
          <Name>Esforço</Name>
          <Duration xsi:type="Time_t"><Seconds>${repDurationSecs}</Seconds></Duration>
          <Intensity>Active</Intensity>
          <Target ${paceTarget(intervalMps, 0.1)}></Target>
        </Child>
        <Child xsi:type="Step_t">
          <StepId>${repId2}</StepId>
          <Name>Recuperação</Name>
          <Duration xsi:type="Time_t"><Seconds>${recovSecs}</Seconds></Duration>
          <Intensity>Rest</Intensity>
          <Target xsi:type="NullTarget_t"/>
        </Child>
      </Step>`);
      void repeatSteps; // steps already inlined above

      steps.push(timeStep("Retorno à calma", cooldownSecs, "Cooldown", paceTarget(easyMps)));
      break;
    }

    default: {
      // Generic: single active step
      steps.push(timeStep("Aquecimento", warmupSecs, "Warmup", ""));
      steps.push(timeStep("Principal", mainSecs, "Active", speedMps ? paceTarget(speedMps) : ""));
      steps.push(timeStep("Retorno à calma", cooldownSecs, "Cooldown", ""));
    }
  }

  return { xml: steps.join("\n      "), stepCount: stepId - 1 };
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
  const session = await prisma.trainingSession.findFirst({
    where: { id, week: { plan: { athleteId: athlete.id } } },
    include: { week: true },
  });
  if (!session) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const scheduledOn = new Date(session.date).toISOString().split("T")[0];
  const notes = escapeXml(
    [session.shortDescription, session.coachTip].filter(Boolean).join(" — ")
  );
  const { xml: stepsXml } = buildSteps(session);

  const tcx = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
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
