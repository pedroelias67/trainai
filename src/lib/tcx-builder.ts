// Shared TCX workout step builder for Garmin watches

export function escapeXml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function sportToTcx(sport: string): string {
  if (sport === "CYCLING") return "Biking";
  if (sport === "SWIMMING") return "Other";
  return "Running";
}

export function paceToMps(pace: string | null | undefined): number | null {
  if (!pace) return null;
  const match = pace.match(/^(\d+):(\d+)$/);
  if (!match) return null;
  return 1000 / (parseInt(match[1]) * 60 + parseInt(match[2]));
}

// HR zone boundaries as % of maxHR
function hrZone(maxHR: number, zone: 1 | 2 | 3 | 4 | 5): { low: number; high: number } {
  const zones = [
    { low: 0.50, high: 0.60 }, // Z1 recovery
    { low: 0.60, high: 0.70 }, // Z2 aerobic
    { low: 0.70, high: 0.80 }, // Z3 tempo
    { low: 0.80, high: 0.90 }, // Z4 threshold
    { low: 0.90, high: 1.00 }, // Z5 VO2max
  ];
  const z = zones[zone - 1];
  return { low: Math.round(maxHR * z.low), high: Math.round(maxHR * z.high) };
}

function hrTarget(maxHR: number, zone: 1 | 2 | 3 | 4 | 5): string {
  const { low, high } = hrZone(maxHR, zone);
  return `xsi:type="HeartRate_t"><Low xsi:type="HeartRateInBeatsPerMinute_t"><Value>${low}</Value></Low><High xsi:type="HeartRateInBeatsPerMinute_t"><Value>${high}</Value></High>`;
}

function paceTarget(mps: number, tol = 0.15): string {
  return `xsi:type="Speed_t"><Low>${(mps - tol).toFixed(3)}</Low><High>${(mps + tol).toFixed(3)}</High>`;
}

function nullTarget(): string {
  return `xsi:type="NullTarget_t"`;
}

function renderTarget(target: string): string {
  if (target === 'xsi:type="NullTarget_t"') return `<Target xsi:type="NullTarget_t"/>`;
  return `<Target ${target}></Target>`;
}

class StepBuilder {
  private id = 1;
  private steps: string[] = [];

  timeStep(label: string, secs: number, intensity: string, target: string) {
    this.steps.push(
      `<Step xsi:type="Step_t">` +
      `<StepId>${this.id++}</StepId>` +
      `<Name>${escapeXml(label)}</Name>` +
      `<Duration xsi:type="Time_t"><Seconds>${Math.round(secs)}</Seconds></Duration>` +
      `<Intensity>${intensity}</Intensity>` +
      renderTarget(target) +
      `</Step>`
    );
    return this;
  }

  distStep(label: string, meters: number, intensity: string, target: string) {
    this.steps.push(
      `<Step xsi:type="Step_t">` +
      `<StepId>${this.id++}</StepId>` +
      `<Name>${escapeXml(label)}</Name>` +
      `<Duration xsi:type="Distance_t"><Meters>${Math.round(meters)}</Meters></Duration>` +
      `<Intensity>${intensity}</Intensity>` +
      renderTarget(target) +
      `</Step>`
    );
    return this;
  }

  repeatBlock(reps: number, children: Array<{ label: string; secs: number; intensity: string; target: string }>) {
    const childSteps = children.map(c =>
      `<Child xsi:type="Step_t">` +
      `<StepId>${this.id++}</StepId>` +
      `<Name>${escapeXml(c.label)}</Name>` +
      `<Duration xsi:type="Time_t"><Seconds>${Math.round(c.secs)}</Seconds></Duration>` +
      `<Intensity>${c.intensity}</Intensity>` +
      renderTarget(c.target) +
      `</Child>`
    ).join("");
    this.steps.push(`<Step xsi:type="Repeat_t">
        <StepId>${this.id++}</StepId>
        <Repetitions>${reps}</Repetitions>
        ${childSteps}
      </Step>`);
    return this;
  }

  build(): string {
    return this.steps.join("\n      ");
  }
}

export interface SessionData {
  sessionType: string;
  sport: string;
  plannedDuration: number | null;
  plannedDistance: number | null;
  plannedPace: string | null;
  shortDescription: string | null;
  coachTip: string | null;
  athleteMaxHR?: number | null;
}

export function buildWorkoutSteps(session: SessionData): string {
  const b = new StepBuilder();
  const totalSecs = (session.plannedDuration ?? 45) * 60;
  const speedMps = paceToMps(session.plannedPace);
  const maxHR = session.athleteMaxHR ?? 180;
  const easyMps = 1000 / (7 * 60); // ~7:00/km easy running default

  const warmupSecs = Math.min(10 * 60, totalSecs * 0.15);
  const cooldownSecs = Math.min(10 * 60, totalSecs * 0.15);
  const mainSecs = totalSecs - warmupSecs - cooldownSecs;

  switch (session.sessionType) {
    // ── RUNNING ──────────────────────────────────────────────────────────
    case "EASY":
    case "RECOVERY": {
      const t = speedMps ? paceTarget(speedMps) : hrTarget(maxHR, session.sessionType === "RECOVERY" ? 1 : 2);
      const mainMeters = session.plannedDistance ? session.plannedDistance * 1000 - 2000 : null;
      if (mainMeters && mainMeters > 0) {
        b.distStep("Aquecimento", 1000, "Warmup", paceTarget(easyMps))
          .distStep("Corrida fácil", mainMeters, "Active", t)
          .distStep("Retorno à calma", 1000, "Cooldown", paceTarget(easyMps));
      } else {
        b.timeStep("Aquecimento", warmupSecs, "Warmup", paceTarget(easyMps))
          .timeStep("Corrida fácil", mainSecs, "Active", t)
          .timeStep("Retorno à calma", cooldownSecs, "Cooldown", paceTarget(easyMps));
      }
      break;
    }

    case "LONG": {
      const t = speedMps ? paceTarget(speedMps) : hrTarget(maxHR, 2);
      const mainMeters = session.plannedDistance ? session.plannedDistance * 1000 - 2000 : null;
      if (mainMeters && mainMeters > 0) {
        b.distStep("Aquecimento", 1000, "Warmup", paceTarget(easyMps))
          .distStep("Longo", mainMeters, "Active", t)
          .distStep("Retorno à calma", 1000, "Cooldown", paceTarget(easyMps));
      } else {
        b.timeStep("Aquecimento", warmupSecs, "Warmup", paceTarget(easyMps))
          .timeStep("Longo", mainSecs, "Active", t)
          .timeStep("Retorno à calma", cooldownSecs, "Cooldown", paceTarget(easyMps));
      }
      break;
    }

    case "TEMPO": {
      const t = speedMps ? paceTarget(speedMps, 0.1) : hrTarget(maxHR, 4);
      b.timeStep("Aquecimento", warmupSecs, "Warmup", paceTarget(easyMps))
        .timeStep("Tempo", mainSecs, "Active", t)
        .timeStep("Retorno à calma", cooldownSecs, "Cooldown", paceTarget(easyMps));
      break;
    }

    case "INTERVALS": {
      const iMps = speedMps ?? 1000 / (4.5 * 60);
      const repSecs = 4 * 60;
      const recovSecs = 2 * 60;
      const reps = Math.max(3, Math.round(mainSecs / (repSecs + recovSecs)));
      b.timeStep("Aquecimento", warmupSecs, "Warmup", paceTarget(easyMps))
        .repeatBlock(reps, [
          { label: "Esforço", secs: repSecs, intensity: "Active", target: paceTarget(iMps, 0.1) },
          { label: "Recuperação", secs: recovSecs, intensity: "Rest", target: nullTarget() },
        ])
        .timeStep("Retorno à calma", cooldownSecs, "Cooldown", paceTarget(easyMps));
      break;
    }

    // ── CYCLING ──────────────────────────────────────────────────────────
    // TCX doesn't support power (watts) targets — use HR zones instead
    case "STRENGTH": {
      // Treat as cycling Z3-Z4 sustained effort when sport is CYCLING
      if (session.sport === "CYCLING") {
        b.timeStep("Aquecimento ciclismo", warmupSecs, "Warmup", hrTarget(maxHR, 2))
          .timeStep("Ritmo sustentado Z3-Z4", mainSecs, "Active", hrTarget(maxHR, 3))
          .timeStep("Retorno à calma", cooldownSecs, "Cooldown", hrTarget(maxHR, 1));
      } else {
        b.timeStep("Aquecimento", warmupSecs, "Warmup", nullTarget())
          .timeStep("Força", mainSecs, "Active", hrTarget(maxHR, 3))
          .timeStep("Retorno à calma", cooldownSecs, "Cooldown", nullTarget());
      }
      break;
    }

    // ── SWIM ─────────────────────────────────────────────────────────────
    // TCX has very limited swim support — basic interval structure
    case "SWIM": {
      const poolLength = 50; // assume 50m pool
      const mainMeters = session.plannedDistance ? session.plannedDistance * 1000 : 2000;
      const warmupMeters = Math.min(200, mainMeters * 0.15);
      const cooldownMeters = Math.min(200, mainMeters * 0.15);
      const setMeters = mainMeters - warmupMeters - cooldownMeters;
      const repLength = 100; // 100m reps
      const reps = Math.max(4, Math.round(setMeters / repLength));
      const repSecs = repLength / (1000 / (2 * 60)); // assume ~2:00/100m
      const recovSecs = 20;

      b.distStep(`Aquecimento ${warmupMeters}m`, warmupMeters, "Warmup", nullTarget())
        .repeatBlock(reps, [
          { label: `${repLength}m`, secs: repSecs, intensity: "Active", target: nullTarget() },
          { label: "Descanso", secs: recovSecs, intensity: "Rest", target: nullTarget() },
        ])
        .distStep(`Retorno à calma ${cooldownMeters}m`, cooldownMeters, "Cooldown", nullTarget());
      void poolLength;
      break;
    }

    // ── BRICK (bike + run) ────────────────────────────────────────────────
    case "BRICK": {
      // Split: ~65% bike, ~35% run (typical brick ratio)
      const bikeSecs = Math.round(totalSecs * 0.65);
      const transitionSecs = 3 * 60; // T2 transition
      const runSecs = totalSecs - bikeSecs - transitionSecs;

      // Bike portion: Z2-Z3 sustained
      b.timeStep("Aquecimento bicicleta", Math.min(10 * 60, bikeSecs * 0.15), "Warmup", hrTarget(maxHR, 2))
        .timeStep("Bicicleta Z3", bikeSecs - Math.min(10 * 60, bikeSecs * 0.15), "Active", hrTarget(maxHR, 3))
        .timeStep("Transição T2", transitionSecs, "Rest", nullTarget());

      // Run portion: off-the-bike pace is typically slower — use HR instead of pace
      const runTarget = speedMps ? paceTarget(speedMps * 0.95, 0.1) : hrTarget(maxHR, 3);
      b.timeStep("Corrida saída bicicleta", Math.min(5 * 60, runSecs * 0.2), "Active", hrTarget(maxHR, 2))
        .timeStep("Corrida sustentada", runSecs - Math.min(5 * 60, runSecs * 0.2), "Active", runTarget);
      break;
    }

    // ── RACE ─────────────────────────────────────────────────────────────
    case "RACE": {
      b.timeStep("Aquecimento", Math.min(15 * 60, totalSecs * 0.2), "Warmup", hrTarget(maxHR, 2))
        .timeStep("Prova", totalSecs - Math.min(15 * 60, totalSecs * 0.2), "Active", hrTarget(maxHR, 4));
      break;
    }

    default: {
      b.timeStep("Aquecimento", warmupSecs, "Warmup", nullTarget())
        .timeStep("Principal", mainSecs, "Active", speedMps ? paceTarget(speedMps) : hrTarget(maxHR, 3))
        .timeStep("Retorno à calma", cooldownSecs, "Cooldown", nullTarget());
    }
  }

  return b.build();
}

export function buildTcxWorkout(session: SessionData & { name: string; date: Date }): string {
  const scheduledOn = new Date(session.date).toISOString().split("T")[0];
  const notes = escapeXml([session.shortDescription, session.coachTip].filter(Boolean).join(" — "));
  const stepsXml = buildWorkoutSteps(session);

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
