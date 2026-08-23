// Race-time prediction from a known performance.
//
// Every distance here is in METRES and every time in SECONDS, matching how
// PersonalRecord and Activity store them. Mixing the two units silently
// produces confident nonsense, so the boundary is stated once, here.

/** Riegel: T2 = T1 × (D2/D1)^1.06 */
export function riegel(knownTimeSecs: number, knownDistM: number, targetDistM: number): number {
  if (knownTimeSecs <= 0 || knownDistM <= 0 || targetDistM <= 0) return 0;
  return knownTimeSecs * Math.pow(targetDistM / knownDistM, 1.06);
}

export type RecordLike = { distance: number; timeSeconds: number };

/**
 * The record closest to the target distance, since Riegel is most reliable over
 * a short extrapolation.
 */
export function pickReferenceRecord<T extends RecordLike>(records: T[], targetMetres: number): T | null {
  const usable = records.filter(r => r.distance > 0 && r.timeSeconds > 0);
  if (usable.length === 0) return null;

  return usable.reduce((best, r) =>
    Math.abs(r.distance - targetMetres) < Math.abs(best.distance - targetMetres) ? r : best
  );
}

/** 5000 → "5 km", 21097 → "21,1 km" */
export function formatRaceDistance(metres: number): string {
  const km = metres / 1000;
  const text = Number.isInteger(km) ? String(km) : km.toFixed(1).replace(".", ",");
  return `${text} km`;
}
