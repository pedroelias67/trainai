// VO2max estimation, from performance only.
//
// Jack Daniels' VDOT derives VO2max from a hard effort's distance and time, and
// is what running watches approximate. The heart-rate ratio (15.3 × HRmax/HRrest)
// was considered and rejected: its ±10-15% error compounds with the fact that
// most athletes only estimate their true HRmax, and a wrong number carries more
// authority than no number. When there is no qualifying effort, this returns
// nothing and the UI says what to run.

export type VO2maxEstimate = {
  value: number;
  /** Human-readable provenance, so the number is never unexplained. */
  source: string;
  date: Date;
  confidence: "alta" | "média";
};

/**
 * Daniels' VDOT. Valid for efforts run at or near maximum, across the range his
 * tables cover — roughly 1500m to the marathon.
 */
export function vdot(distanceMetres: number, timeSeconds: number): number | null {
  if (distanceMetres <= 0 || timeSeconds <= 0) return null;

  const minutes = timeSeconds / 60;
  const velocity = distanceMetres / minutes; // m/min

  const vo2 = -4.6 + 0.182258 * velocity + 0.000104 * velocity * velocity;
  const percentMax =
    0.8 +
    0.1894393 * Math.exp(-0.012778 * minutes) +
    0.2989558 * Math.exp(-0.1932605 * minutes);

  if (percentMax <= 0) return null;
  const result = vo2 / percentMax;
  return result > 0 && result < 100 ? Math.round(result * 10) / 10 : null;
}

export type EffortRecord = {
  distance: number; // metres
  timeSeconds: number;
  date: Date | string;
};

// Below ~3.5min the effort is more anaerobic than aerobic; beyond ~3h the result
// reflects endurance and fuelling more than aerobic capacity. Either end would
// understate the athlete, so those efforts are skipped rather than used.
const MIN_SECONDS = 3.5 * 60;
const MAX_SECONDS = 3 * 3600;

function formatDistance(metres: number): string {
  if (metres >= 1000) {
    const km = metres / 1000;
    return `${Number.isInteger(km) ? km : km.toFixed(1)} km`;
  }
  return `${Math.round(metres)} m`;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  const mm = String(m).padStart(h > 0 ? 2 : 1, "0");
  return h > 0
    ? `${h}:${mm}:${String(s).padStart(2, "0")}`
    : `${mm}:${String(s).padStart(2, "0")}`;
}

/**
 * Picks the effort that yields the highest VDOT, which is the one that best
 * reflects current shape. Efforts outside the formula's valid range, and those
 * older than `maxAgeMonths`, are ignored rather than quietly distorting it.
 */
export function estimateVO2max(
  records: EffortRecord[],
  now = new Date(),
  maxAgeMonths = 12
): VO2maxEstimate | null {
  const cutoff = new Date(now.getFullYear(), now.getMonth() - maxAgeMonths, now.getDate());

  let best: { value: number; record: EffortRecord } | null = null;
  for (const r of records) {
    if (r.timeSeconds < MIN_SECONDS || r.timeSeconds > MAX_SECONDS) continue;
    if (new Date(r.date) < cutoff) continue;
    const value = vdot(r.distance, r.timeSeconds);
    if (value !== null && (!best || value > best.value)) best = { value, record: r };
  }

  if (!best) return null;

  const when = new Date(best.record.date);
  const ageMonths = (now.getTime() - when.getTime()) / (1000 * 60 * 60 * 24 * 30.4);
  return {
    value: best.value,
    source: `${formatDistance(best.record.distance)} em ${formatTime(best.record.timeSeconds)}`,
    date: when,
    // A performance from months ago describes the shape you had then.
    confidence: ageMonths <= 3 ? "alta" : "média",
  };
}

/**
 * Best effort per activity. Easy runs are harmless here: the estimate takes the
 * maximum VDOT, so only the hardest effort in the window can win.
 */
export function effortsFromActivities(
  activities: { date: Date | string; sport: string; distance: number | null; duration: number | null }[]
): EffortRecord[] {
  return activities
    .filter(a => a.sport === "RUNNING" && a.distance && a.duration)
    .map(a => ({ distance: a.distance!, timeSeconds: a.duration!, date: a.date }));
}

/**
 * Where a value sits for the athlete's age and sex, using the Cooper Institute
 * bands. Returns null when age or sex is unknown rather than assuming either.
 */
export function vo2maxRating(
  value: number,
  age: number | null,
  gender: string | null
): string | null {
  if (!age || !gender) return null;
  const male = gender === "MALE";

  // Thresholds for [superior, excelente, bom, razoável] — below the last is "fraco".
  const bands: Record<string, number[]> = male
    ? { "20": [56, 51, 45, 42], "30": [54, 48, 44, 41], "40": [52, 46, 42, 38], "50": [48, 43, 39, 35], "60": [45, 39, 35, 31] }
    : { "20": [49, 44, 39, 35], "30": [45, 41, 36, 34], "40": [43, 39, 34, 32], "50": [39, 35, 31, 29], "60": [36, 32, 28, 26] };

  const decade = Math.min(Math.max(Math.floor(age / 10) * 10, 20), 60);
  const [superior, excelente, bom, razoavel] = bands[String(decade)];

  if (value >= superior) return "Superior";
  if (value >= excelente) return "Excelente";
  if (value >= bom) return "Bom";
  if (value >= razoavel) return "Razoável";
  return "A construir";
}
