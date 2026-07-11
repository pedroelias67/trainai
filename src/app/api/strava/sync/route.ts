import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getRecentStravaActivities, refreshStravaToken } from "@/lib/strava";
import { syncStravaActivity } from "@/lib/sync-activity";

export async function POST() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("user_id")?.value;
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const athlete = await prisma.athlete.findUnique({ where: { userId } });
  if (!athlete?.stravaConnected) {
    return NextResponse.json({ error: "Strava não conectado" }, { status: 400 });
  }

  let accessToken = athlete.stravaAccessToken!;
  if (athlete.stravaTokenExpiry && athlete.stravaTokenExpiry < new Date()) {
    const newTokens = await refreshStravaToken(athlete.stravaRefreshToken!);
    accessToken = newTokens.access_token;
    await prisma.athlete.update({
      where: { id: athlete.id },
      data: {
        stravaAccessToken: newTokens.access_token,
        stravaRefreshToken: newTokens.refresh_token,
        stravaTokenExpiry: new Date(newTokens.expires_at * 1000),
      },
    });
  }

  const afterTimestamp = Math.floor(Date.now() / 1000) - 28 * 24 * 60 * 60;
  const stravaActivities = await getRecentStravaActivities(accessToken, afterTimestamp);

  let synced = 0;
  for (const sa of stravaActivities) {
    await syncStravaActivity(String(sa.id), athlete.id, accessToken);
    synced++;
  }

  return NextResponse.json({ synced });
}
