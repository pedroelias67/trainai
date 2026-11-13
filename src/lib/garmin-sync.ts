import { prisma } from "@/lib/prisma";
import { fetchGarminDays, garminWellnessSummary } from "@/lib/garmin";
import { utcMidnight } from "@/lib/plan-calendar";

const DAY_MS = 24 * 60 * 60 * 1000;

export type SyncResult =
  | { status: "saved"; days: number; withSleep: number; withHrv: number }
  | { status: "skipped"; reason: "not-connected" }
  | { status: "failed"; error: string };

/**
 * Brings down what the watch measured and writes it alongside the plan.
 *
 * Stored rather than read live, for two reasons: the adaptation runs in a job
 * with a budget to keep, and Garmin is pull-only, so a day nobody asked about
 * while it was recent is a day lost. Re-running is safe — each day is written
 * once per athlete and updated in place.
 *
 * Never throws. The caller is doing something that matters more.
 */
export async function syncGarminDays(athleteId: string, days = 14): Promise<SyncResult> {
  try {
    const athlete = await prisma.athlete.findUnique({
      where: { id: athleteId },
      select: { garminApiKey: true },
    });
    if (!athlete?.garminApiKey) return { status: "skipped", reason: "not-connected" };

    const hoje = utcMidnight(new Date());
    const inicio = new Date(hoje.getTime() - (days - 1) * DAY_MS);

    const r = await fetchGarminDays(athlete.garminApiKey, inicio, hoje);
    if (!r.ok) {
      await prisma.athlete.update({
        where: { id: athleteId },
        data: { garminSyncError: r.error, garminLastSyncAt: new Date() },
      });
      return { status: "failed", error: r.error };
    }

    for (const d of r.data) {
      const date = new Date(`${d.date}T00:00:00.000Z`);
      const dados = {
        sleepSeconds: d.sleepSeconds, deepSleepSeconds: d.deepSleepSeconds,
        remSleepSeconds: d.remSleepSeconds, awakeSeconds: d.awakeSeconds,
        hrvLastNight: d.hrvLastNight, hrvWeeklyAvg: d.hrvWeeklyAvg, hrvStatus: d.hrvStatus,
        fetchedAt: new Date(),
      };
      await prisma.garminDay.upsert({
        where: { athleteId_date: { athleteId, date } },
        create: { athleteId, date, ...dados },
        update: dados,
      });
    }

    await prisma.athlete.update({
      where: { id: athleteId },
      data: { garminSyncError: null, garminLastSyncAt: new Date() },
    });

    return {
      status: "saved",
      days: r.data.length,
      withSleep: r.data.filter(d => d.sleepSeconds !== null).length,
      withHrv: r.data.filter(d => d.hrvLastNight !== null).length,
    };
  } catch (err) {
    return { status: "failed", error: err instanceof Error ? err.message : "Erro inesperado" };
  }
}

/**
 * The measured week, as the weekly adaptation should read it.
 *
 * Empty when the athlete has no Garmin link or the watch recorded nothing,
 * which leaves the adaptation with the manual log alone — the state it was in
 * before any of this existed.
 */
export async function garminSummaryForAdaptation(athleteId: string, days = 7): Promise<string> {
  const desde = new Date(utcMidnight(new Date()).getTime() - (days - 1) * DAY_MS);
  const dias = await prisma.garminDay.findMany({
    where: { athleteId, date: { gte: desde } },
    orderBy: { date: "asc" },
  });

  return garminWellnessSummary(
    dias.map(d => ({
      date: d.date.toISOString().slice(0, 10),
      sleepSeconds: d.sleepSeconds, deepSleepSeconds: d.deepSleepSeconds,
      remSleepSeconds: d.remSleepSeconds, awakeSeconds: d.awakeSeconds,
      hrvLastNight: d.hrvLastNight, hrvWeeklyAvg: d.hrvWeeklyAvg,
      hrvStatus: d.hrvStatus as never,
    }))
  );
}
