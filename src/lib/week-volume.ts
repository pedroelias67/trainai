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
