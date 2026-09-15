export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRecentStravaActivities, StravaAuthError } from "@/lib/strava";
import { getValidStravaToken, recordStravaSync } from "@/lib/strava-connection";
import { syncStravaActivity } from "@/lib/sync-activity";
import { recalculatePersonalRecords } from "@/lib/personal-records";
import { getSessionUserId } from "@/lib/session";

export async function POST() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const athlete = await prisma.athlete.findUnique({ where: { userId } });
  if (!athlete?.stravaConnected) {
    return NextResponse.json({ error: "Strava não conectado" }, { status: 400 });
  }

  let synced = 0;
  try {
    const accessToken = await getValidStravaToken(athlete);
    const afterTimestamp = Math.floor(Date.now() / 1000) - 28 * 24 * 60 * 60;
    const stravaActivities = await getRecentStravaActivities(accessToken, afterTimestamp);
    for (const sa of stravaActivities) {
      await syncStravaActivity(String(sa.id), athlete.id, accessToken);
      synced++;
    }
    await recordStravaSync(athlete.id, null);
  } catch (err) {
    await recordStravaSync(athlete.id, err).catch(() => {});
    if (err instanceof StravaAuthError) {
      return NextResponse.json(
        { error: "O Strava deixou de aceitar a ligação. Liga o Strava outra vez no perfil." },
        { status: 401 }
      );
    }
    throw err;
  }

  // Records are derived from the full activity history, so they only stay
  // current if this runs whenever new activities land.
  let records: string[] = [];
  if (synced > 0) {
    try {
      records = await recalculatePersonalRecords(athlete.id);
    } catch (err) {
      // A failure here must not lose the activities that were just imported.
      console.error("Personal records recalculation failed:", err);
    }
  }

  return NextResponse.json({ synced, records: records.length });
}
