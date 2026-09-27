// The races an athlete can enter, in one place.
//
// These lists lived inside the onboarding page, which was the only screen that
// could create a race. Now that races can also be added later, they are shared
// rather than copied — a second copy is how the distance labels would drift
// apart from the enum the plan generator reads.

export const SPORTS = [
  { value: "RUNNING", label: "Corrida", icon: "🏃" },
  { value: "TRIATHLON_SPRINT", label: "Triatlo Sprint", icon: "⚡" },
  { value: "TRIATHLON_OLYMPIC", label: "Triatlo Olímpico", icon: "🔱" },
  { value: "TRIATHLON_HALF", label: "Half Ironman", icon: "💪" },
  { value: "TRIATHLON_FULL", label: "Ironman", icon: "🔴" },
];

export const DISTANCES: Record<string, Array<{ value: string; label: string }>> = {
  RUNNING: [
    { value: "FIVE_K", label: "5km" },
    { value: "TEN_K", label: "10km" },
    { value: "HALF_MARATHON", label: "Meia Maratona" },
    { value: "MARATHON", label: "Maratona" },
    { value: "ULTRA", label: "Ultra" },
  ],
  TRIATHLON_SPRINT: [{ value: "SPRINT_TRIATHLON", label: "Triatlo Sprint" }],
  TRIATHLON_OLYMPIC: [{ value: "OLYMPIC_TRIATHLON", label: "Triatlo Olímpico" }],
  TRIATHLON_HALF: [{ value: "HALF_IRONMAN", label: "70.3 Half Ironman" }],
  TRIATHLON_FULL: [{ value: "IRONMAN", label: "140.6 Ironman" }],
};

/** The written-out distance, for showing a race back to the athlete. */
export const DISTANCE_LABELS: Record<string, string> = Object.fromEntries(
  Object.values(DISTANCES).flat().map(d => [d.value, d.label])
);

/**
 * What each grade of race does to the plan around it.
 *
 * Shown where a race is entered, because the difference between B and C is the
 * difference between losing three days of training and losing none — and the
 * athlete is the only one who knows which the race deserves.
 */
export const PRIORITIES = [
  {
    value: "A",
    label: "A — Objetivo principal",
    help: "A prova para que o plano é construído, com taper completo.",
  },
  {
    value: "B",
    label: "B — Importa",
    help: "Alivia os três dias antes e o dia seguinte. Se for longa, faz de treino longo dessa semana.",
  },
  {
    value: "C",
    label: "C — Como treino",
    help: "Sem aliviar nada. Ocupa o lugar do treino duro dessa semana, em vez de se somar a ele.",
  },
];
