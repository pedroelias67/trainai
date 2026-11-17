// What a week actually adds up to.
//
// Every week carries a total, and it was whatever number the model wrote next
// to the sessions — which is not the same as the sum of those sessions. A week
// of 40 km was showing as 26. The athlete reads that number to judge whether a
// plan is too heavy, and it was understating by half.
//
// The sessions are the plan. The total is arithmetic, so it is done here rather
// than asked for.

export type SessionVolume = {
  plannedDistanceKm?: number | null;
  plannedDurationMin?: number | null;
};

export type WeekVolume = { km: number; minutes: number };

export function weekVolume(sessions: SessionVolume[]): WeekVolume {
  const km = sessions.reduce((t, s) => t + (s.plannedDistanceKm ?? 0), 0);
  return {
    km: Math.round(km * 10) / 10,
    minutes: sessions.reduce((t, s) => t + (s.plannedDurationMin ?? 0), 0),
  };
}

/** The same, for sessions already stored as rows. */
export function weekVolumeFromRows(
  rows: Array<{ plannedDistance: number | null; plannedDuration: number | null }>
): WeekVolume {
  return weekVolume(
    rows.map(r => ({ plannedDistanceKm: r.plannedDistance, plannedDurationMin: r.plannedDuration }))
  );
}

/**
 * How far the first week may sit above what the athlete has actually been
 * running. The same ten per cent the prompt asks for, held to here.
 */
export const MAX_OVER_RECENT_PEAK = 1.1;

type CappableSession = {
  sessionType: string;
  plannedDistanceKm?: number | null;
  plannedDurationMin?: number | null;
};

export type FirstWeekCap = { from: number; to: number; peak: number } | null;

/**
 * Brings the first week down to what the athlete can already do.
 *
 * The plan is told the athlete's highest recent week and asked to start near
 * it. Asked, not held to: a block written in September opened at 48 km for
 * someone whose best week in the previous month had been 40.3, and then
 * progressed correctly from a starting point that was already too high.
 *
 * Only the first week, and only downwards. What follows progresses from here,
 * and a week the model deliberately made easy is not something to inflate.
 *
 * A race in the week is left alone — its distance is the distance — and if the
 * race alone puts the week over, nothing is changed: there is no honest way to
 * shrink a week around a fixed event, and quietly cutting the training around
 * it would be worse than leaving it to be read.
 */
export function capFirstWeek<W extends { weekNumber: number; sessions: CappableSession[] }>(
  weeks: W[],
  peakKmPerWeek: number | null | undefined
): { weeks: W[]; capped: FirstWeekCap } {
  if (!peakKmPerWeek || peakKmPerWeek <= 0 || weeks.length === 0) return { weeks, capped: null };

  const primeiro = Math.min(...weeks.map(w => w.weekNumber));
  const semana = weeks.find(w => w.weekNumber === primeiro);
  if (!semana) return { weeks, capped: null };

  const total = weekVolume(semana.sessions).km;
  const limite = Math.round(peakKmPerWeek * MAX_OVER_RECENT_PEAK * 10) / 10;
  if (total <= limite) return { weeks, capped: null };

  const fixo = semana.sessions
    .filter(s => s.sessionType === "RACE")
    .reduce((t, s) => t + (s.plannedDistanceKm ?? 0), 0);
  const ajustavel = total - fixo;
  const alvo = limite - fixo;
  if (ajustavel <= 0 || alvo <= 0) return { weeks, capped: null };

  const factor = alvo / ajustavel;
  const sessions = semana.sessions.map(s => {
    if (s.sessionType === "RACE") return s;
    const km = s.plannedDistanceKm;
    const min = s.plannedDurationMin;
    return {
      ...s,
      // Distance and duration move together, so the pace each session implies
      // is the one it was written with.
      plannedDistanceKm: km ? Math.round(km * factor * 10) / 10 : km,
      plannedDurationMin: min ? Math.round(min * factor) : min,
    };
  });

  const refeita = { ...semana, sessions } as W;
  const depois = weekVolume(sessions);

  return {
    weeks: weeks.map(w => (w.weekNumber === primeiro ? refeita : w)),
    capped: { from: total, to: depois.km, peak: peakKmPerWeek },
  };
}
