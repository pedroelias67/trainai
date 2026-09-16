export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { loadConnections } from "@/lib/admin-connections";
import { checkStravaConnection } from "@/lib/strava-connection";
import { checkIntervalsConnection } from "@/lib/intervals-icu";
import { checkWeekOnCalendar, recordIntervalsCheck, recordWeekOnCalendar } from "@/lib/intervals-connection";

/**
 * Tests every link for real, stores what it finds, and returns the updated view.
 *
 * On demand rather than on page load: each check is a call to Strava or
 * Intervals.icu, and Strava's limits are shared by every athlete's syncs.
 */
export async function POST() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const athletes = await prisma.athlete.findMany({
    where: { OR: [{ stravaConnected: true }, { intervalsIcuApiKey: { not: null } }] },
    select: { id: true, stravaConnected: true, intervalsIcuApiKey: true, intervalsIcuAthleteId: true },
  });

  let checked = 0;
  await Promise.all(athletes.map(async a => {
    const jobs: Promise<unknown>[] = [];
    if (a.stravaConnected) jobs.push(checkStravaConnection(a.id));
    if (a.intervalsIcuApiKey && a.intervalsIcuAthleteId) {
      jobs.push(
        checkIntervalsConnection(a.intervalsIcuApiKey, a.intervalsIcuAthleteId)
          .then(check => recordIntervalsCheck(a.id, check))
      );
      jobs.push(checkWeekOnCalendar(a).then(on => recordWeekOnCalendar(a.id, on)));
    }
    // One athlete's failure is a result to show, not a reason to stop the rest.
    await Promise.allSettled(jobs);
    checked += jobs.length;
  }));

  return NextResponse.json({ checked, connections: await loadConnections() });
}
