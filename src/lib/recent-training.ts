// What the athlete has actually been doing, for the plan generator.
//
// The generator was told the athlete's level, their available hours and the
// race. Nothing about the training they had already built. Someone regenerating
// halfway through a block — to change their training days, say — got a plan
// written as if they were starting today, which can undo weeks of progression
// at the worst possible moment.

export type PastActivity = { date: Date; distance: number | null; sport: string };

export type RecentTraining = {
  weeks: number;
  avgKmPerWeek: number;
  /** The biggest single week. A taper drags the average down and says nothing about form. */
  peakKmPerWeek: number;
  sessionsPerWeek: number;
  longestRunKm: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Summarises the last `weeks` weeks of running. Null when there is too little to say. */
export function summariseRecentTraining(
  activities: PastActivity[],
  now = new Date(),
  weeks = 4
): RecentTraining | null {
  const since = new Date(now.getTime() - weeks * 7 * DAY_MS);
  const runs = activities.filter(
    a => a.sport === "RUNNING" && a.date >= since && a.date <= now && (a.distance ?? 0) > 0
  );
  // Two or three runs say nothing about a weekly habit.
  if (runs.length < 4) return null;

  const totalKm = runs.reduce((sum, a) => sum + (a.distance ?? 0), 0) / 1000;
  const longest = Math.max(...runs.map(a => (a.distance ?? 0))) / 1000;

  // Weeks counted back from now, so a taper shows up as one low week rather
  // than as a lower athlete.
  const perWeek = new Array(weeks).fill(0);
  for (const a of runs) {
    const index = Math.min(Math.floor((now.getTime() - a.date.getTime()) / (7 * DAY_MS)), weeks - 1);
    perWeek[index] += (a.distance ?? 0) / 1000;
  }

  return {
    weeks,
    avgKmPerWeek: Math.round((totalKm / weeks) * 10) / 10,
    peakKmPerWeek: Math.round(Math.max(...perWeek) * 10) / 10,
    sessionsPerWeek: Math.round((runs.length / weeks) * 10) / 10,
    longestRunKm: Math.round(longest * 10) / 10,
  };
}

/** How this is put to the model, or nothing at all when there is no history. */
export function recentTrainingGuidance(recent: RecentTraining | null): string {
  if (!recent) return "";
  return [
    `TREINO RECENTE (últimas ${recent.weeks} semanas, dados reais):`,
    `- Volume médio: ${recent.avgKmPerWeek} km por semana`,
    `- Semana mais alta: ${recent.peakKmPerWeek} km`,
    `- Treinos de corrida: ${recent.sessionsPerWeek} por semana`,
    `- Treino mais longo: ${recent.longestRunKm} km`,
    `Parte daqui: este atleta não está a começar. A média pode estar baixa por causa de um`,
    `taper ou de uma prova recente — a semana mais alta diz melhor onde ele está. A primeira`,
    `semana do plano deve ficar próxima desse nível, nunca mais de 10% acima, e progredir a`,
    `partir dele. Recomeçar do zero desperdiça a forma já construída.`,
  ].join("\n");
}
