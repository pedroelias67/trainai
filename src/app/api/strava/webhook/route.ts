import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { refreshStravaToken } from "@/lib/strava";
import { syncStravaActivity } from "@/lib/sync-activity";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN ?? "trainai_webhook";

  if (mode === "subscribe" && token === verifyToken) {
    return NextResponse.json({ "hub.challenge": challenge });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(req: NextRequest) {
  try {
    const event = await req.json();

    if (event.object_type !== "activity" || event.aspect_type !== "create") {
      return NextResponse.json({ ok: true });
    }

    const stravaAthleteId = String(event.owner_id);
    const stravaActivityId = String(event.object_id);

    const athlete = await prisma.athlete.findFirst({ where: { stravaAthleteId } });
    if (!athlete) return NextResponse.json({ ok: true });

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

    await syncStravaActivity(stravaActivityId, athlete.id, accessToken);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Strava webhook error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
