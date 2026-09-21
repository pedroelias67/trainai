// Time and pace formatting shared across the app.
//
// Each of these used to split minutes and seconds first and round the seconds
// afterwards, so 5:59.7 came out as "5:60". Rounding the total before splitting
// is the whole fix; having it in one place is what keeps it fixed.

/** Hours, minutes and seconds of a duration, rounded to the nearest second first. */
export function clockParts(seconds: number): { h: number; m: number; s: number } {
  const total = Math.round(seconds);
  return {
    h: Math.floor(total / 3600),
    m: Math.floor((total % 3600) / 60),
    s: total % 60,
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** 359.7 → "6:00/km" (never "5:60/km"). */
export function formatPacePerKm(secondsPerKm: number): string {
  const total = Math.round(secondsPerKm);
  return `${Math.floor(total / 60)}:${pad(total % 60)}/km`;
}

/** "2:04:35", or "27:11" under an hour. */
export function formatClock(seconds: number): string {
  const { h, m, s } = clockParts(seconds);
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** "5:25/km" → 325 seconds. Null for anything that is not a written pace. */
export function paceToSeconds(pace: string | null): number | null {
  if (!pace) return null;
  const m = pace.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const secs = Number(m[1]) * 60 + Number(m[2]);
  return secs > 0 ? secs : null;
}
