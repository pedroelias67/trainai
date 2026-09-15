// The state of an athlete's link to Strava: keeping the token usable, and
// remembering what happened the last time it was used.
//
// Before this, a sync failure went to the server log and nowhere else. An athlete
// whose link had broken simply stopped receiving activities, and nobody — them
// or the admin — could tell that from a week of not running.

import { prisma } from "@/lib/prisma";
import { refreshStravaToken, StravaAuthError } from "@/lib/strava";

/** Refresh this far ahead of expiry, so a token cannot lapse halfway through a sync. */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

export const REVOKED_MESSAGE = "O Strava recusou o acesso — a ligação tem de ser refeita";

type TokenFields = {
  id: string;
  stravaAccessToken: string | null;
  stravaRefreshToken: string | null;
  stravaTokenExpiry: Date | null;
};

/**
 * An access token that works now, refreshed and saved first when it is about to
 * expire. Saving is not optional: Strava may issue a new refresh token with each
 * refresh, and one that is used but not stored leaves the athlete unable to sync.
 */
export async function getValidStravaToken(athlete: TokenFields): Promise<string> {
  if (!athlete.stravaAccessToken || !athlete.stravaRefreshToken) {
    throw new StravaAuthError(401);
  }
  const expiresSoon =
    !athlete.stravaTokenExpiry ||
    athlete.stravaTokenExpiry.getTime() - Date.now() < REFRESH_MARGIN_MS;
  if (!expiresSoon) return athlete.stravaAccessToken;

  const tokens = await refreshStravaToken(athlete.stravaRefreshToken);
  await prisma.athlete.update({
    where: { id: athlete.id },
    data: {
      stravaAccessToken: tokens.access_token,
      stravaRefreshToken: tokens.refresh_token,
      stravaTokenExpiry: new Date(tokens.expires_at * 1000),
    },
  });
  return tokens.access_token;
}

/** What the admin reads for a failure: plain, and short enough for a status line. */
export function describeStravaError(err: unknown): string {
  if (err instanceof StravaAuthError) return REVOKED_MESSAGE;
  const msg = err instanceof Error ? err.message : String(err);
  return msg.slice(0, 200);
}

/** Records the outcome of using the link. `null` means it worked. */
export async function recordStravaSync(athleteId: string, err: unknown | null): Promise<void> {
  await prisma.athlete.update({
    where: { id: athleteId },
    data: err === null
      ? { stravaLastSyncAt: new Date(), stravaSyncError: null, stravaSyncErrorAt: null }
      : { stravaSyncError: describeStravaError(err), stravaSyncErrorAt: new Date() },
  });
}

/**
 * The athlete removed the app on Strava's side. Their tokens are now useless and
 * are dropped; activities already imported stay. The profile then shows Strava
 * as disconnected, which is the prompt to connect again.
 */
export async function handleStravaDeauthorization(stravaAthleteId: string): Promise<void> {
  await prisma.athlete.updateMany({
    where: { stravaAthleteId },
    data: {
      stravaConnected: false,
      stravaAccessToken: null,
      stravaRefreshToken: null,
      stravaTokenExpiry: null,
      stravaSyncError: "Acesso à app removido no Strava pelo atleta",
      stravaSyncErrorAt: new Date(),
    },
  });
}

/** Whether a Strava event is the athlete revoking the app. Strava's docs guarantee the key, not the aspect. */
export function isDeauthorization(event: { object_type?: string; updates?: Record<string, unknown> }): boolean {
  return event.object_type === "athlete" && String(event.updates?.authorized) === "false";
}

/**
 * Tries the link for real: a usable token, then a request Strava must answer.
 * The result is stored like any sync, so the admin page keeps it.
 */
export async function checkStravaConnection(athleteId: string): Promise<{ ok: boolean; error: string | null }> {
  const athlete = await prisma.athlete.findUniqueOrThrow({
    where: { id: athleteId },
    select: { id: true, stravaAccessToken: true, stravaRefreshToken: true, stravaTokenExpiry: true },
  });
  try {
    const token = await getValidStravaToken(athlete);
    const res = await fetch("https://www.strava.com/api/v3/athlete", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) throw new StravaAuthError(401);
    if (!res.ok) throw new Error(`Strava respondeu ${res.status}`);
    // A working link clears an old failure, but a check is not a sync: the last
    // imported activity time is left as it was.
    await prisma.athlete.update({
      where: { id: athleteId },
      data: { stravaSyncError: null, stravaSyncErrorAt: null },
    });
    return { ok: true, error: null };
  } catch (err) {
    await prisma.athlete.update({
      where: { id: athleteId },
      data: { stravaSyncError: describeStravaError(err), stravaSyncErrorAt: new Date() },
    });
    return { ok: false, error: describeStravaError(err) };
  }
}
