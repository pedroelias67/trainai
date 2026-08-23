// Aggregates activities into per-month totals for the training summary.
// Months with no activity are kept in the series so gaps stay visible.

export type StatActivity = {
  date: Date | string;
  sport: string;
  distance: number | null; // metres
  duration: number | null; // seconds
  elevationGain: number | null; // metres
};

export type MonthStat = {
  key: string; // "2026-08"
  year: number;
  month: number; // 1-12
  activities: number;
  km: number;
  seconds: number;
  elevation: number;
  /** Running only, derived from total time over total distance — not an average of averages. */
  paceSecPerKm: number | null;
  kmBySport: Record<string, number>;
  /** Percent change in km against the previous month; null when there is nothing to compare. */
  kmChangePct: number | null;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

export function monthlyStats(activities: StatActivity[], months: number, now = new Date()): MonthStat[] {
  const series: MonthStat[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const ref = new Date(now.getFullYear(), now.getMonth() - i, 1);
    series.push({
      key: `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}`,
      year: ref.getFullYear(),
      month: ref.getMonth() + 1,
      activities: 0,
      km: 0,
      seconds: 0,
      elevation: 0,
      paceSecPerKm: null,
      kmBySport: {},
      kmChangePct: null,
    });
  }

  const byKey = new Map(series.map(m => [m.key, m]));
  // Running distance and time are tracked apart so pace is not skewed by cycling.
  const runTotals = new Map<string, { km: number; seconds: number }>();

  for (const a of activities) {
    const d = new Date(a.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const bucket = byKey.get(key);
    if (!bucket) continue;

    const km = (a.distance ?? 0) / 1000;
    bucket.activities += 1;
    bucket.km += km;
    bucket.seconds += a.duration ?? 0;
    bucket.elevation += a.elevationGain ?? 0;
    if (km > 0) bucket.kmBySport[a.sport] = (bucket.kmBySport[a.sport] ?? 0) + km;

    if (a.sport === "RUNNING" && km > 0 && a.duration) {
      const run = runTotals.get(key) ?? { km: 0, seconds: 0 };
      run.km += km;
      run.seconds += a.duration;
      runTotals.set(key, run);
    }
  }

  for (const m of series) {
    const run = runTotals.get(m.key);
    m.paceSecPerKm = run && run.km > 0 ? Math.round(run.seconds / run.km) : null;
    m.km = round1(m.km);
    m.elevation = Math.round(m.elevation);
    for (const sport of Object.keys(m.kmBySport)) {
      m.kmBySport[sport] = round1(m.kmBySport[sport]);
    }
  }

  // Only compare against a month that actually had training, so the first month
  // back after a break does not read as an infinite jump.
  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1].km;
    if (prev > 0) {
      series[i].kmChangePct = Math.round(((series[i].km - prev) / prev) * 100);
    }
  }

  return series;
}

export function formatPace(secPerKm: number | null): string | null {
  if (!secPerKm || secPerKm <= 0) return null;
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")}/km`;
}

export function formatHours(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h === 0) return `${m}min`;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}
