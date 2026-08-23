// VO2max estimation.
//
// Two methods, because they answer different questions:
//
//   Heart-rate reserve — reads pace against heart rate on ordinary training
//   runs. Since %HRR approximates %VO2max, a run's oxygen cost divided by its
//   share of heart-rate reserve extrapolates to the maximum. This is roughly
//   what a running watch does, and it needs no maximal effort.
//
//   VDOT — Daniels' formula, which answers "if this effort were maximal, what
//   would your VO2max be". Exact when the athlete actually raced, and a floor
//   otherwise: a 5K run at training pace reports the fitness that pace proves,
//   not the fitness the athlete has.
//
// The heart-rate method leads because most athletes never race. VDOT is used
// when it comes out higher, which can only happen if an effort really was close
// to maximal.
//
// Not to be confused with the bare ratio 15.3 × HRmax/HRrest, which ignores
// running data entirely and is not used here.

export type VO2maxMethod = "heart-rate-reserve" | "performance";

export type VO2maxEstimate = {
  value: number;
  method: VO2maxMethod;
  /** Human-readable provenance, so the number is never unexplained. */
  source: string;
  date: Date;
  confidence: "alta" | "média";
};

/** Oxygen cost of running at a given velocity, in m/min (Daniels). */
export function vo2AtVelocity(metresPerMin: number): number {
  return -4.6 + 0.182258 * metresPerMin + 0.000104 * metresPerMin * metresPerMin;
}

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

export type HeartRates = { restingHR: number | null; maxHR: number | null };

export type HeartRateRun = {
  date: Date | string;
  sport: string;
  distance: number | null; // metres
  duration: number | null; // seconds
  avgHR: number | null;
};

/**
 * VO2max implied by one run's pace and heart rate.
 *
 * Runs well below half of heart-rate reserve are rejected: the extrapolation to
 * maximum becomes long enough that a few beats of drift swing the answer wildly.
 */
export function vo2maxFromRun(
  metres: number,
  seconds: number,
  avgHR: number,
  hr: HeartRates
): number | null {
  const { restingHR, maxHR } = hr;
  if (!restingHR || !maxHR || maxHR <= restingHR) return null;
  if (metres <= 0 || seconds <= 0) return null;

  const reserve = (avgHR - restingHR) / (maxHR - restingHR);
  if (reserve < 0.5 || reserve > 1) return null;

  const velocity = metres / (seconds / 60);
  const vo2 = vo2AtVelocity(velocity);
  if (vo2 <= 0) return null;

  const result = vo2 / reserve;
  return result > 20 && result < 90 ? Math.round(result * 10) / 10 : null;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Median across recent runs rather than the best of them: a single run with a
 * misread heart rate would otherwise set the number, and it would only ever
 * ratchet upward.
 */
export function estimateFromHeartRate(
  runs: HeartRateRun[],
  hr: HeartRates,
  now = new Date(),
  windowDays = 90
): VO2maxEstimate | null {
  const cutoff = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);

  const values: number[] = [];
  let latest: Date | null = null;

  for (const run of runs) {
    if (run.sport !== "RUNNING" || !run.distance || !run.duration || !run.avgHR) continue;
    const when = new Date(run.date);
    if (when < cutoff) continue;

    const value = vo2maxFromRun(run.distance, run.duration, run.avgHR, hr);
    if (value === null) continue;

    values.push(value);
    if (!latest || when > latest) latest = when;
  }

  if (values.length < 3 || !latest) return null;

  return {
    value: Math.round(median(values) * 10) / 10,
    method: "heart-rate-reserve",
    source: `${values.length} treinos dos últimos ${windowDays} dias, por pace e FC`,
    date: latest,
    confidence: values.length >= 8 ? "alta" : "média",
  };
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
    method: "performance",
    source: `${formatDistance(best.record.distance)} em ${formatTime(best.record.timeSeconds)}`,
    date: when,
    // A performance from months ago describes the shape you had then.
    confidence: ageMonths <= 3 ? "alta" : "média",
  };
}

/**
 * Combines both readings. VDOT only wins when it exceeds the heart-rate estimate,
 * which requires an effort close to maximal — exactly the case VDOT is exact for.
 */
export function bestVO2maxEstimate(
  runs: HeartRateRun[],
  hr: HeartRates,
  now = new Date()
): VO2maxEstimate | null {
  const fromHeartRate = estimateFromHeartRate(runs, hr, now);
  const fromPerformance = estimateVO2max(effortsFromActivities(runs), now);

  if (fromHeartRate && fromPerformance) {
    return fromPerformance.value > fromHeartRate.value ? fromPerformance : fromHeartRate;
  }
  return fromHeartRate ?? fromPerformance;
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
