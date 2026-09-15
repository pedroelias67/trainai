export const dynamic = "force-dynamic";

import { NextRequest, NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { StravaAuthError } from "@/lib/strava";
import { syncStravaActivity } from "@/lib/sync-activity";
import { recalculatePersonalRecords } from "@/lib/personal-records";
import * as Sentry from "@sentry/nextjs";
import {
  checkStravaConnection,
  getValidStravaToken,
  handleStravaDeauthorization,
  isDeauthorization,
  recordStravaSync,
} from "@/lib/strava-connection";

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
  const event = await req.json().catch(() => null);
  if (!event) return NextResponse.json({ ok: true });

  // Strava wants a 200 within two seconds and retries up to three times without
  // one. Importing an activity — three Strava calls, then records — takes longer,
  // so the work runs after the response instead of before it.
  after(() => handleEvent(event));
  return NextResponse.json({ ok: true });
}

async function handleEvent(event: {
  object_type?: string;
  aspect_type?: string;
  object_id?: number | string;
  owner_id?: number | string;
  updates?: Record<string, unknown>;
}) {
  const stravaAthleteId = String(event.owner_id);
  const athlete = await prisma.athlete.findFirst({ where: { stravaAthleteId } });
  if (!athlete) return;

  if (isDeauthorization(event)) {
    // Strava does not sign these events, so anyone could post one. Before
    // dropping a link, make sure Strava really no longer honours it.
    const check = await checkStravaConnection(athlete.id);
    if (!check.ok) await handleStravaDeauthorization(stravaAthleteId);
    return;
  }

  if (event.object_type !== "activity" || event.aspect_type !== "create") return;

  try {
    const accessToken = await getValidStravaToken(athlete);
    await syncStravaActivity(String(event.object_id), athlete.id, accessToken);
    await recordStravaSync(athlete.id, null);
  } catch (err) {
    await recordStravaSync(athlete.id, err).catch(() => {});
    if (!(err instanceof StravaAuthError)) {
      Sentry.captureException(err, { tags: { stage: "webhook-sync" } });
    }
    return;
  }

  // This is how nearly every activity arrives, and records were only ever
  // recalculated by the manual sync — so a half marathon synced on its own
  // never reached the records page.
  try {
    await recalculatePersonalRecords(athlete.id);
  } catch (err) {
    // The activity is already saved; a records failure must not undo that.
    Sentry.captureException(err, { tags: { stage: "webhook-records" } });
  }
}
