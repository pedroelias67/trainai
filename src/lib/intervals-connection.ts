// Remembers what happened the last time an athlete's Intervals.icu link was used,
// so a broken one shows up on the admin page instead of as a silent watch.

import { prisma } from "@/lib/prisma";
import type { IntervalsCheck } from "@/lib/intervals-icu";

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
