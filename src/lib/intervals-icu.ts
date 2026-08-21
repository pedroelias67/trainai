// Converts a planned session into an Intervals.icu calendar event.
//
// Intervals.icu pushes planned workouts on to Garmin, COROS, Suunto and Wahoo,
// so one integration covers the brands whose own APIs each need a separate
// partnership. Their workout format is line based: steps start with "-", a bare
// "Nx" line opens a repeat block, and each step carries a duration and a target
// (an HR zone, or an absolute pace for running).

import { parseIntervals, parseLeadingDuration } from "./workout-phases";

const SPORT_TO_TYPE: Record<string, string> = {
  RUNNING: "Run",
  CYCLING: "Ride",
  SWIMMING: "Swim",
};

/** The zone each session type is built around, when no pace target is available. */
const TYPE_TO_ZONE: Record<string, string> = {
  EASY: "Z2",
  RECOVERY: "Z1",
  LONG: "Z2",
  TEMPO: "Z4",
  INTERVALS: "Z5",
  STRENGTH: "Z3",
  BRICK: "Z3",
  SWIM: "Z2",
  RACE: "Z4",
};

export type PlannedSession = {
  id: string;
  name: string;
  sport: string;
  sessionType: string;
  date: Date | string;
  plannedDuration: number | null; // minutes
  plannedPace: string | null;
  warmup: string | null;
  mainSet: string | null;
  cooldown: string | null;
};

export type IntervalsEvent = {
  category: "WORKOUT";
  start_date_local: string;
  type: string;
  name: string;
  description: string;
  external_id: string;
};

/** Intervals.icu durations look like "10m" or "5m30s". */
export function formatDuration(secs: number): string {
  const rounded = Math.max(Math.round(secs), 1);
  const m = Math.floor(rounded / 60);
  const s = rounded % 60;
  if (m === 0) return `${s}s`;
  return s === 0 ? `${m}m` : `${m}m${s}s`;
}

/** Only a well-formed pace is passed through; anything else falls back to zones. */
export function normalisePace(pace: string | null): string | null {
  if (!pace) return null;
  const m = pace.trim().match(/^(\d{1,2}:\d{2})\s*\/\s*(km|mi)$/i);
  return m ? `${m[1]}/${m[2].toLowerCase()}` : null;
}

export function buildWorkoutDescription(session: PlannedSession): string {
  const total = (session.plannedDuration ?? 60) * 60;
  const zone = TYPE_TO_ZONE[session.sessionType] ?? "Z2";
  const pace = session.sport === "RUNNING" ? normalisePace(session.plannedPace) : null;
  const workTarget = pace ? `${pace} Pace` : `${zone} HR`;

  const spec = parseIntervals(session.mainSet);
  const lines: string[] = [];

  if (spec) {
    const warmupSecs = parseLeadingDuration(session.warmup) ?? Math.round(total * 0.2);
    const cooldownSecs = parseLeadingDuration(session.cooldown) ?? Math.round(total * 0.15);

    lines.push("Warmup", `- ${formatDuration(warmupSecs)} Z1 HR`, "");
    lines.push(`${spec.reps}x`, `- ${formatDuration(spec.workSecs)} ${workTarget}`);
    if (spec.restSecs) lines.push(`- ${formatDuration(spec.restSecs)} Z1 HR`);
    lines.push("", "Cooldown", `- ${formatDuration(cooldownSecs)} Z1 HR`);
    return lines.join("\n");
  }

  // Continuous session: a short warmup and cooldown around one sustained block,
  // matching how the in-app timer splits the same session.
  if (session.sessionType === "RECOVERY") {
    return `- ${formatDuration(total)} Z1 HR`;
  }

  const warmupSecs = parseLeadingDuration(session.warmup) ?? Math.round(total * 0.15);
  const cooldownSecs = parseLeadingDuration(session.cooldown) ?? Math.round(total * 0.1);
  const mainSecs = Math.max(total - warmupSecs - cooldownSecs, 60);

  lines.push("Warmup", `- ${formatDuration(warmupSecs)} Z1 HR`, "");
  lines.push(`- ${formatDuration(mainSecs)} ${workTarget}`, "");
  lines.push("Cooldown", `- ${formatDuration(cooldownSecs)} Z1 HR`);
  return lines.join("\n");
}

const API = "https://intervals.icu/api/v1";

/** Intervals.icu uses basic auth with the literal username "API_KEY". */
function authHeader(apiKey: string): string {
  return `Basic ${Buffer.from(`API_KEY:${apiKey}`).toString("base64")}`;
}

/** Confirms a key works and returns the athlete it belongs to. */
export async function verifyApiKey(
  apiKey: string
): Promise<{ id: string; name: string | null } | null> {
  const res = await fetch(`${API}/athlete/0/profile`, {
    headers: { Authorization: authHeader(apiKey) },
  });
  if (!res.ok) return null;

  const data = await res.json().catch(() => null);
  const athlete = data?.athlete ?? data;
  if (!athlete?.id) return null;
  return { id: String(athlete.id), name: athlete.name ?? null };
}

/**
 * Upserts events by external_id, so re-pushing a week updates the existing
 * entries rather than stacking duplicates on the athlete's calendar.
 */
export async function pushEvents(
  apiKey: string,
  athleteId: string,
  events: IntervalsEvent[]
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  if (events.length === 0) return { ok: true, count: 0 };

  const res = await fetch(`${API}/athlete/${athleteId}/events/bulk?upsert=true`, {
    method: "POST",
    headers: {
      Authorization: authHeader(apiKey),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(events),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return { ok: false, error: `Intervals.icu respondeu ${res.status}. ${detail.slice(0, 200)}`.trim() };
  }
  return { ok: true, count: events.length };
}

export function buildCalendarEvent(session: PlannedSession): IntervalsEvent {
  const date = new Date(session.date);
  // Intervals.icu expects a local timestamp with no zone suffix.
  const startLocal = `${date.toISOString().split("T")[0]}T00:00:00`;

  return {
    category: "WORKOUT",
    start_date_local: startLocal,
    type: SPORT_TO_TYPE[session.sport] ?? "Run",
    name: session.name,
    description: buildWorkoutDescription(session),
    // Lets a re-push update the same event instead of duplicating it.
    external_id: `trainai-${session.id}`,
  };
}
