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

/**
 * A workout as structure rather than prose, written by the AI when it details
 * the session. Deriving this from the coach's text loses whatever the text does
 * not spell out in a shape the parser recognises — the strides inside a warmup
 * being the clearest example, since they vanish into a single easy block.
 */
export type WorkoutStep = {
  /** "10m", "5m30s", "45s", "800mtr", "1km" — the forms Intervals.icu parses. */
  duration: string;
  /** "Z2 HR", "5:02/km Pace", "5:05-4:58/km Pace". Omitted means no target. */
  target?: string;
};

export type WorkoutBlock = {
  /** Section heading, e.g. "Aquecimento". Omitted for the body of the session. */
  name?: string;
  /** Times to repeat the steps below. Absent or 1 means once. */
  repeat?: number;
  steps: WorkoutStep[];
};

const DURATION_RE = /^\d{1,4}(m|s|km|mtr)(\d{1,2}s)?$/;
const TARGET_RE = /^(Z[1-5] HR|\d{1,2}:\d{2}(-\d{1,2}:\d{2})?\/(km|mi) Pace)$/;

/**
 * Keeps only what Intervals.icu will actually accept. The model writes these,
 * and a malformed duration or target would be sent verbatim to someone's watch.
 */
export function sanitiseSteps(raw: unknown): WorkoutBlock[] | null {
  if (!Array.isArray(raw)) return null;

  const blocks: WorkoutBlock[] = [];
  for (const b of raw) {
    if (!b || typeof b !== "object" || !Array.isArray((b as any).steps)) continue;

    const steps: WorkoutStep[] = [];
    for (const s of (b as any).steps) {
      const duration = typeof s?.duration === "string" ? s.duration.trim() : "";
      if (!DURATION_RE.test(duration)) continue;
      const target = typeof s?.target === "string" ? s.target.trim() : "";
      // Every step gets a target. A bare "- 2m" tells the athlete to run for two
      // minutes at nothing in particular, and appears to be where Intervals.icu
      // stops reading the workout. Walking, mobility and stretching — which is
      // what these untargeted steps are — belong in Z1 anyway.
      steps.push({ duration, target: TARGET_RE.test(target) ? target : "Z1 HR" });
    }
    if (steps.length === 0) continue;

    const repeat = Number((b as any).repeat);
    blocks.push({
      ...(typeof (b as any).name === "string" && (b as any).name.trim()
        ? { name: (b as any).name.trim().slice(0, 40) }
        : {}),
      ...(Number.isInteger(repeat) && repeat > 1 && repeat <= 30 ? { repeat } : {}),
      steps,
    });
  }

  return blocks.length > 0 ? blocks : null;
}

/** Renders the structure in Intervals.icu's line format. */
export function renderSteps(blocks: WorkoutBlock[]): string {
  const out: string[] = [];
  for (const b of blocks) {
    if (out.length > 0) out.push("");
    if (b.name) out.push(b.name);
    if (b.repeat && b.repeat > 1) out.push(`${b.repeat}x`);
    for (const s of b.steps) out.push(`- ${s.duration}${s.target ? ` ${s.target}` : ""}`);
  }
  return out.join("\n");
}

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
  /** Structure written by the AI; when present it is used verbatim. */
  steps?: unknown;
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

/**
 * Pulls a pace target out of whatever the coach wrote.
 *
 * Requiring the whole field to be exactly "5:02/km" threw away most of them:
 * plans say "5:02/km nas repetições" or give a band, "4:58-5:05/km". Both are
 * usable, and a band is better — Intervals.icu takes a range directly, which is
 * closer to how the session is meant to be run. Ranges are emitted slowest
 * first, matching their format.
 */
export function normalisePace(pace: string | null): string | null {
  if (!pace) return null;

  const range = pace.match(/(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})\s*\/\s*(km|mi)/i);
  if (range) {
    const a = parseInt(range[1], 10) * 60 + parseInt(range[2], 10);
    const b = parseInt(range[3], 10) * 60 + parseInt(range[4], 10);
    const unit = range[5].toLowerCase();
    const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    return `${fmt(Math.max(a, b))}-${fmt(Math.min(a, b))}/${unit}`;
  }

  const single = pace.match(/(\d{1,2}:\d{2})\s*\/\s*(km|mi)/i);
  return single ? `${single[1]}/${single[2].toLowerCase()}` : null;
}

/**
 * Pace band per zone, as multiples of threshold pace, slowest bound first to
 * match Intervals.icu's range order.
 *
 * The easy end is deliberately wide. A recovery jog pinned to a narrow band is
 * a watch that beeps at an athlete who is doing exactly what the session asks.
 */
const ZONE_PACE_BAND: Record<string, [number, number]> = {
  Z1: [1.50, 1.25],
  Z2: [1.32, 1.15],
  Z3: [1.16, 1.05],
  Z4: [1.06, 0.97],
  Z5: [0.99, 0.90],
};

/** Midpoint of each band, for reading a threshold pace back out of a session. */
const ZONE_PACE_MID: Record<string, number> = {
  Z1: 1.375, Z2: 1.235, Z3: 1.105, Z4: 1.015, Z5: 0.945,
};

/** 2:30/km to 10:00/km. Outside this, whatever produced the number is wrong. */
const PLAUSIBLE_THRESHOLD = { min: 150, max: 600 };
const plausible = (secs: number) =>
  secs >= PLAUSIBLE_THRESHOLD.min && secs <= PLAUSIBLE_THRESHOLD.max;

function formatPaceSecs(secs: number): string {
  const s = Math.round(secs);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Seconds per kilometre for a written pace, taking the middle of a range. */
export function paceMidSeconds(pace: string | null): number | null {
  const norm = normalisePace(pace);
  if (!norm) return null;
  const m = norm.match(/^(\d{1,2}):(\d{2})(?:-(\d{1,2}):(\d{2}))?\/(km|mi)$/);
  if (!m) return null;
  const a = Number(m[1]) * 60 + Number(m[2]);
  const b = m[3] ? Number(m[3]) * 60 + Number(m[4]) : a;
  const perUnit = (a + b) / 2;
  return m[5] === "mi" ? perUnit / 1.609344 : perUnit;
}

/**
 * The athlete's threshold pace in seconds per kilometre, which anchors every
 * zone-to-pace conversion.
 *
 * Their stated threshold wins. Failing that it is read back out of the plan
 * itself: each session carries a planned pace and a session type, and the type
 * says which zone that pace belongs to — so dividing by the zone's midpoint
 * gives an implied threshold. The median across the week absorbs the odd
 * session whose pace the plan wrote loosely.
 */
export function inferThresholdPace(
  ltPace: string | null,
  sessions: Array<{ sport: string; sessionType: string; plannedPace: string | null }>
): number | null {
  const stated = paceMidSeconds(ltPace);
  if (stated && plausible(stated)) return stated;

  const implied: number[] = [];
  for (const s of sessions) {
    if (s.sport !== "RUNNING") continue;
    const pace = paceMidSeconds(s.plannedPace);
    const mid = ZONE_PACE_MID[TYPE_TO_ZONE[s.sessionType] ?? ""];
    if (!pace || !mid) continue;
    const threshold = pace / mid;
    if (plausible(threshold)) implied.push(threshold);
  }
  if (implied.length === 0) return null;

  implied.sort((a, b) => a - b);
  return implied[Math.floor(implied.length / 2)];
}

/** Rewrites a single "Z3 HR" target as the pace band that zone corresponds to. */
export function zoneToPaceTarget(target: string, thresholdSecPerKm: number): string {
  const m = target.match(/^Z([1-5]) HR$/);
  if (!m) return target;
  const [slow, fast] = ZONE_PACE_BAND[`Z${m[1]}`];
  return `${formatPaceSecs(thresholdSecPerKm * slow)}-${formatPaceSecs(thresholdSecPerKm * fast)}/km Pace`;
}

/** The athlete's pace bands written out, for a prompt or an explanation. */
export function zonePaceTable(thresholdSecPerKm: number): string {
  return (["Z1", "Z2", "Z3", "Z4", "Z5"] as const)
    .map(z => `${z} ${zoneToPaceTarget(`${z} HR`, thresholdSecPerKm).replace("/km Pace", "")}`)
    .join(", ");
}

/**
 * Turns every heart-rate target in a workout into a pace band.
 *
 * A watch can only guide towards what the step targets. Target heart rate and
 * the pace is left to the lap summary — which arrives once the step is already
 * over, so the athlete learns how fast they ran instead of how fast to run. It
 * also means a single session guides by heart rate in some steps and by pace in
 * others, which reads as two different workouts stitched together.
 */
export function retargetToPace(
  blocks: WorkoutBlock[],
  thresholdSecPerKm: number
): WorkoutBlock[] {
  return blocks.map(b => ({
    ...b,
    steps: b.steps.map(s => ({
      ...s,
      ...(s.target ? { target: zoneToPaceTarget(s.target, thresholdSecPerKm) } : {}),
    })),
  }));
}

export function buildWorkoutDescription(
  session: PlannedSession,
  thresholdSecPerKm: number | null = null
): string {
  // Pace targets are for running: on a bike or in the water the same number
  // means nothing, and heart rate remains the honest target there.
  const threshold =
    session.sport === "RUNNING" && thresholdSecPerKm && plausible(thresholdSecPerKm)
      ? thresholdSecPerKm
      : null;
  const zoneTarget = (zone: string) =>
    threshold ? zoneToPaceTarget(`${zone} HR`, threshold) : `${zone} HR`;

  // Structure the model declared beats structure inferred from its prose, and
  // carries detail the prose route cannot — strides, drills, distance steps.
  const declared = sanitiseSteps(session.steps);
  if (declared) return renderSteps(threshold ? retargetToPace(declared, threshold) : declared);

  const total = (session.plannedDuration ?? 60) * 60;
  const zone = TYPE_TO_ZONE[session.sessionType] ?? "Z2";
  // The pace often sits in the main set rather than the dedicated field, which
  // is where the band lives too.
  const pace =
    session.sport === "RUNNING"
      ? normalisePace(session.plannedPace) ?? normalisePace(session.mainSet)
      : null;
  const workTarget = pace ? `${pace} Pace` : zoneTarget(zone);
  const easy = zoneTarget("Z1");

  const spec = parseIntervals(session.mainSet);
  const lines: string[] = [];

  if (spec) {
    const warmupSecs = parseLeadingDuration(session.warmup) ?? Math.round(total * 0.2);
    const cooldownSecs = parseLeadingDuration(session.cooldown) ?? Math.round(total * 0.15);

    lines.push("Warmup", `- ${formatDuration(warmupSecs)} ${easy}`, "");
    lines.push(`${spec.reps}x`, `- ${formatDuration(spec.workSecs)} ${workTarget}`);
    if (spec.restSecs) lines.push(`- ${formatDuration(spec.restSecs)} ${easy}`);
    lines.push("", "Cooldown", `- ${formatDuration(cooldownSecs)} ${easy}`);
    return lines.join("\n");
  }

  // Continuous session: a short warmup and cooldown around one sustained block,
  // matching how the in-app timer splits the same session.
  if (session.sessionType === "RECOVERY") {
    return `- ${formatDuration(total)} ${easy}`;
  }

  const warmupSecs = parseLeadingDuration(session.warmup) ?? Math.round(total * 0.15);
  const cooldownSecs = parseLeadingDuration(session.cooldown) ?? Math.round(total * 0.1);
  const mainSecs = Math.max(total - warmupSecs - cooldownSecs, 60);

  lines.push("Warmup", `- ${formatDuration(warmupSecs)} ${easy}`, "");
  lines.push(`- ${formatDuration(mainSecs)} ${workTarget}`, "");
  lines.push("Cooldown", `- ${formatDuration(cooldownSecs)} ${easy}`);
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

export function buildCalendarEvent(
  session: PlannedSession,
  thresholdSecPerKm: number | null = null
): IntervalsEvent {
  const date = new Date(session.date);
  // Intervals.icu expects a local timestamp with no zone suffix.
  const startLocal = `${date.toISOString().split("T")[0]}T00:00:00`;

  return {
    category: "WORKOUT",
    start_date_local: startLocal,
    type: SPORT_TO_TYPE[session.sport] ?? "Run",
    name: session.name,
    description: buildWorkoutDescription(session, thresholdSecPerKm),
    // Lets a re-push update the same event instead of duplicating it.
    external_id: `trainai-${session.id}`,
  };
}
