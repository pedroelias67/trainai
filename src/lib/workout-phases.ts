// Turns a planned session into the phases the in-app timer counts through.
// Kept apart from the component so it can be exercised directly by tests.

export type Phase = {
  label: string;
  duration: number; // seconds, 0 = open-ended
  color: string;
};

export type SessionText = {
  warmup: string | null;
  mainSet: string | null;
  cooldown: string | null;
};

function toSeconds(value: number, unit: string): number {
  return /^s/i.test(unit) ? value : value * 60;
}

/** First duration mentioned in a step's description, e.g. "10min caminhada" → 600. */
export function parseLeadingDuration(text: string | null): number | null {
  if (!text) return null;
  const m = text.match(/(\d{1,3})\s*(min\w*|'|s\w*)/i);
  if (!m) return null;
  const secs = toSeconds(parseInt(m[1], 10), m[2]);
  return secs >= 60 && secs <= 40 * 60 ? secs : null;
}

/**
 * Reads the repetition structure out of the coach's own words, e.g.
 * "5x3min Z5 com 2min de recuperação activa" → 5 reps of 3min, 2min apart.
 * Distance-based sets ("6x800m") are deliberately not matched — they cannot be
 * timed without assuming a pace — and fall back to the coarse phases.
 */
export function parseIntervals(
  mainSet: string | null
): { reps: number; workSecs: number; restSecs: number | null } | null {
  if (!mainSet) return null;

  const sane = (reps: number, workSecs: number) =>
    reps >= 2 && reps <= 30 && workSecs >= 20 && workSecs <= 30 * 60;
  const asRest = (secs: number | null) => (secs && secs > 0 && secs <= 15 * 60 ? secs : null);

  // "4x(3min forte + 2min fácil)" states the recovery without naming it.
  const paired = mainSet.match(
    /(\d{1,2})\s*[x×]\s*\(\s*(\d{1,3})\s*(min\w*|'|s\w*)[^)]*?\+\s*(\d{1,3})\s*(min\w*|'|s\w*)/i
  );
  if (paired) {
    const reps = parseInt(paired[1], 10);
    const workSecs = toSeconds(parseInt(paired[2], 10), paired[3]);
    if (sane(reps, workSecs)) {
      return { reps, workSecs, restSecs: asRest(toSeconds(parseInt(paired[4], 10), paired[5])) };
    }
  }

  const rep = mainSet.match(/(\d{1,2})\s*[x×]\s*\(?\s*(\d{1,3})\s*(min\w*|'|s\w*)/i);
  if (!rep) return null;

  const reps = parseInt(rep[1], 10);
  const workSecs = toSeconds(parseInt(rep[2], 10), rep[3]);
  if (!sane(reps, workSecs)) return null;

  // Recovery has to be named, so a pace like "6:30/km" is never mistaken for one.
  // Matching runs to the next digit rather than over \w+, which stops at the
  // accents in "recuperação".
  const rest =
    mainSet.match(/(?:rec|descanso)[^\d]{0,15}(\d{1,3})\s*(min\w*|'|s\w*)/i) ??
    mainSet.match(/(\d{1,3})\s*(min\w*|'|s\w*)\s*(?:de\s+)?(?:rec|descanso)/i);

  return { reps, workSecs, restSecs: asRest(rest ? toSeconds(parseInt(rest[1], 10), rest[2]) : null) };
}

export function buildPhases(
  sessionType: string,
  plannedDuration: number | null,
  text: SessionText
): Phase[] {
  // plannedDuration is stored in minutes (the plan writes plannedDurationMin);
  // every phase below is in seconds.
  const total = (plannedDuration ?? 60) * 60;

  // Sessions built on repetitions get one phase per rep rather than a single
  // undifferentiated block, so the timer actually paces the set.
  if (sessionType === "INTERVALS" || sessionType === "TEMPO") {
    const spec = parseIntervals(text.mainSet);
    if (spec) {
      const warmupSecs = parseLeadingDuration(text.warmup) ?? Math.round(total * 0.20);
      const cooldownSecs = parseLeadingDuration(text.cooldown) ?? Math.round(total * 0.15);
      const work = sessionType === "TEMPO" ? "#f97316" : "#ef4444";

      const phases: Phase[] = [{ label: "Aquecimento", duration: warmupSecs, color: "#22c55e" }];
      for (let i = 1; i <= spec.reps; i++) {
        phases.push({ label: `Série ${i}/${spec.reps}`, duration: spec.workSecs, color: work });
        if (spec.restSecs && i < spec.reps) {
          phases.push({ label: "Recuperação", duration: spec.restSecs, color: "#3b82f6" });
        }
      }
      phases.push({ label: "Arrefecimento", duration: cooldownSecs, color: "#a1a1aa" });
      return phases;
    }
  }

  const phaseMap: Record<string, Phase[]> = {
    EASY: [
      { label: "Aquecimento", duration: Math.round(total * 0.15), color: "#22c55e" },
      { label: "Corrida fácil", duration: Math.round(total * 0.75), color: "#3b82f6" },
      { label: "Arrefecimento", duration: Math.round(total * 0.10), color: "#a1a1aa" },
    ],
    LONG: [
      { label: "Aquecimento", duration: Math.round(total * 0.10), color: "#22c55e" },
      { label: "Corrida longa", duration: Math.round(total * 0.80), color: "#3b82f6" },
      { label: "Arrefecimento", duration: Math.round(total * 0.10), color: "#a1a1aa" },
    ],
    RECOVERY: [
      { label: "Corrida suave", duration: total, color: "#52525b" },
    ],
    TEMPO: [
      { label: "Aquecimento", duration: Math.round(total * 0.20), color: "#22c55e" },
      { label: "Tempo", duration: Math.round(total * 0.60), color: "#f97316" },
      { label: "Arrefecimento", duration: Math.round(total * 0.20), color: "#a1a1aa" },
    ],
    INTERVALS: [
      { label: "Aquecimento", duration: Math.round(total * 0.20), color: "#22c55e" },
      { label: "Intervalos", duration: Math.round(total * 0.60), color: "#ef4444" },
      { label: "Arrefecimento", duration: Math.round(total * 0.20), color: "#a1a1aa" },
    ],
    SWIM: [
      { label: "Aquecimento", duration: Math.round(total * 0.20), color: "#06b6d4" },
      { label: "Série principal", duration: Math.round(total * 0.60), color: "#3b82f6" },
      { label: "Arrefecimento", duration: Math.round(total * 0.20), color: "#a1a1aa" },
    ],
    BRICK: [
      { label: "Bicicleta", duration: Math.round(total * 0.65), color: "#eab308" },
      { label: "Transição T2", duration: 180, color: "#a855f7" },
      { label: "Corrida", duration: Math.round(total * 0.32), color: "#f97316" },
    ],
    STRENGTH: [
      { label: "Aquecimento", duration: 600, color: "#22c55e" },
      // Fixed 10min warmup + 5min stretching: keep the main block positive on
      // sessions shorter than that.
      { label: "Força", duration: Math.max(total - 900, 300), color: "#a855f7" },
      { label: "Alongamentos", duration: 300, color: "#a1a1aa" },
    ],
  };

  return phaseMap[sessionType] ?? [{ label: "Treino", duration: total, color: "#22c55e" }];
}
