// What a race distance implies for the training around it.
//
// The plan prompt named the event ("TEN_K") and left the rest to the model,
// which wrote an 18 km long run into a 10K plan — nearly twice the race. Any
// coach caps the long run against the distance being trained for, so the cap is
// stated in the prompt and then enforced on what comes back.

export const RACE_KM: Record<string, number> = {
  FIVE_K: 5,
  TEN_K: 10,
  HALF_MARATHON: 21.1,
  MARATHON: 42.2,
  ULTRA: 60,
  SPRINT_TRIATHLON: 5,
  OLYMPIC_TRIATHLON: 10,
  HALF_IRONMAN: 21.1,
  IRONMAN: 42.2,
};

/**
 * The longest single run a plan for this race should contain.
 *
 * Short races are trained with long runs well beyond the distance — a 5K plan
 * with a 12 km run is ordinary — while marathon plans stop short of it. The
 * ratio therefore falls as the race gets longer, and these are absolute
 * kilometres rather than a formula for that reason.
 */
export const LONG_RUN_CAP_KM: Record<string, number> = {
  FIVE_K: 12,
  TEN_K: 16,
  HALF_MARATHON: 22,
  MARATHON: 34,
  ULTRA: 45,
  SPRINT_TRIATHLON: 12,
  OLYMPIC_TRIATHLON: 16,
  HALF_IRONMAN: 22,
  IRONMAN: 32,
};

/** The stretch of weekly running volume a plan for this race normally sits in. */
const WEEKLY_KM_RANGE: Record<string, [number, number]> = {
  FIVE_K: [25, 60],
  TEN_K: [30, 70],
  HALF_MARATHON: [40, 90],
  MARATHON: [50, 110],
  ULTRA: [60, 140],
};

/** What to tell the model about the race it is writing a plan for. */
export function raceGuidance(distance: string): string {
  const km = RACE_KM[distance];
  const cap = LONG_RUN_CAP_KM[distance];
  if (!km || !cap) return "";

  const range = WEEKLY_KM_RANGE[distance];
  return [
    `DISTÂNCIA DA PROVA: ${km} km.`,
    `- O treino longo NUNCA excede ${cap} km. Numa prova curta o longo serve a base aeróbica,`,
    `  não a distância da prova — mas ${cap} km é o tecto, e a maioria das semanas fica abaixo.`,
    range ? `- Volume semanal típico para esta distância: ${range[0]}-${range[1]} km, conforme o nível e as horas disponíveis.` : "",
    `- A qualidade é específica da prova: quanto mais curta, mais curtas e rápidas as repetições.`,
  ].filter(Boolean).join("\n");
}

export type SessionVolume = { sessionType: string; plannedDistanceKm?: number | null; plannedDurationMin?: number | null };

/**
 * Brings an over-long session back to the cap, shortening its duration in step
 * so the pace it implies stays the same.
 *
 * The prompt says the same thing, but a plan is written once and trained for
 * weeks: worth enforcing rather than hoping.
 */
export function capLongRun<T extends SessionVolume>(session: T, eventDistance: string): T {
  const cap = LONG_RUN_CAP_KM[eventDistance];
  const km = session.plannedDistanceKm;
  // A race session is the race: never cut that one.
  if (!cap || !km || km <= cap || session.sessionType === "RACE") return session;

  const factor = cap / km;
  return {
    ...session,
    plannedDistanceKm: cap,
    ...(session.plannedDurationMin
      ? { plannedDurationMin: Math.round(session.plannedDurationMin * factor) }
      : {}),
  };
}
