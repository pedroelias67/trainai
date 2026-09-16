// Remembers what happened the last time an athlete's Intervals.icu link was used,
// so a broken one shows up on the admin page instead of as a silent watch.

import { endOfWeek, startOfWeek } from "date-fns";
import { prisma } from "@/lib/prisma";
import { pushedSessionIds, type IntervalsCheck } from "@/lib/intervals-icu";

export const THRESHOLD_MISSING_WARNING =
  "Falta o ritmo de limiar nas definições de corrida do Intervals.icu. Sem ele, os alvos de ritmo são descartados a caminho do relógio";

export const KEY_REFUSED_ERROR = "Chave do Intervals.icu recusada — tem de ser ligada de novo";

/** Stores the outcome of a key/settings check. An unreachable service proves nothing either way. */
export async function recordIntervalsCheck(athleteId: string, check: IntervalsCheck): Promise<void> {
  if (check.status === "unreachable") return;

  if (check.status === "invalid-key") {
    await prisma.athlete.update({
      where: { id: athleteId },
      data: { intervalsIcuPushError: KEY_REFUSED_ERROR, intervalsIcuCheckedAt: new Date() },
    });
    return;
  }

  await prisma.athlete.update({
    where: { id: athleteId },
    data: { intervalsIcuHasRunThreshold: check.hasRunThreshold, intervalsIcuCheckedAt: new Date() },
  });
  // A key that works is no longer a refused one.
  await prisma.athlete.updateMany({
    where: { id: athleteId, intervalsIcuPushError: KEY_REFUSED_ERROR },
    data: { intervalsIcuPushError: null },
  });
}

/** Stores the outcome of sending a week. `null` means it worked. */
export async function recordIntervalsPush(athleteId: string, error: string | null): Promise<void> {
  await prisma.athlete.update({
    where: { id: athleteId },
    data: error === null
      ? { intervalsIcuLastPushAt: new Date(), intervalsIcuPushError: null }
      : { intervalsIcuPushError: error.slice(0, 200) },
  });
}

/**
 * Whether every session planned for this week is on the athlete's Intervals.icu
 * calendar — which is what decides whether their watch has the week, and unlike
 * a "last sent" timestamp it stays true even for weeks sent before we recorded
 * anything. Null when there is nothing planned or the calendar cannot be read.
 */
export async function checkWeekOnCalendar(athlete: {
  id: string;
  intervalsIcuApiKey: string | null;
  intervalsIcuAthleteId: string | null;
}): Promise<boolean | null> {
  if (!athlete.intervalsIcuApiKey || !athlete.intervalsIcuAthleteId) return null;

  const from = startOfWeek(new Date(), { weekStartsOn: 1 });
  const to = endOfWeek(new Date(), { weekStartsOn: 1 });

  const planned = await prisma.trainingSession.findMany({
    where: {
      cancelled: false,
      date: { gte: from, lte: to },
      week: { plan: { athleteId: athlete.id, status: "ACTIVE" } },
    },
    select: { id: true },
  });
  if (planned.length === 0) return null;

  const onCalendar = await pushedSessionIds(
    athlete.intervalsIcuApiKey,
    athlete.intervalsIcuAthleteId,
    from.toISOString().slice(0, 10),
    to.toISOString().slice(0, 10)
  );
  if (!onCalendar) return null;

  return planned.every(s => onCalendar.has(s.id));
}

/** Stores what a calendar look-up found. Null leaves the last answer alone. */
export async function recordWeekOnCalendar(athleteId: string, onCalendar: boolean | null): Promise<void> {
  if (onCalendar === null) return;
  await prisma.athlete.update({
    where: { id: athleteId },
    data: { intervalsIcuWeekOnCalendar: onCalendar },
  });
}
