export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getStravaAuthUrl, refreshStravaToken, STRAVA_STATE_COOKIE } from "@/lib/strava";
import { prisma } from "@/lib/prisma";
import * as Sentry from "@sentry/nextjs";
import { getSessionUserId } from "@/lib/session";

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.redirect(new URL("/auth/login", req.url));

  // The state used to be the user's id in base64, and the callback believed it:
  // anyone who knew an id could send Strava's reply to that account and bind
  // their own Strava to it. Now it is random, kept in a cookie this browser
  // holds, and the callback takes the user from the session instead.
  const state = crypto.randomBytes(24).toString("base64url");
  const res = NextResponse.redirect(getStravaAuthUrl(state));
  res.cookies.set(STRAVA_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 10 * 60,
    path: "/api/strava",
  });
  return res;
}

/**
 * Lets go of the athlete's Strava.
 *
 * There was no way to do this. An athlete who authorised the wrong account —
 * a browser signed in as someone else, an old account — was bound to it: the
 * app showed a healthy green link that would never deliver an activity, and
 * the only way out was to revoke it from Strava's own settings, which nothing
 * told them. One of them sat like that for weeks.
 *
 * The token is revoked at Strava rather than only forgotten here, so the app
 * stops holding access to an account it should not have, and the athlete stops
 * occupying one of the application's connected-athlete slots.
 *
 * Activities already imported stay. They are the athlete's training history,
 * not a property of the link that brought them in.
 */
export async function DELETE() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const athlete = await prisma.athlete.findUnique({
    where: { userId },
    select: { id: true, stravaAccessToken: true, stravaRefreshToken: true, stravaTokenExpiry: true },
  });
  if (!athlete) return NextResponse.json({ error: "Atleta não encontrado" }, { status: 404 });

  // Best effort: a refusal from Strava must not leave the athlete still bound
  // here, which is the state this exists to escape.
  let revogado = false;
  try {
    let token = athlete.stravaAccessToken;
    if (token && (!athlete.stravaTokenExpiry || athlete.stravaTokenExpiry < new Date())) {
      token = athlete.stravaRefreshToken
        ? (await refreshStravaToken(athlete.stravaRefreshToken)).access_token
        : null;
    }
    if (token) {
      const res = await fetch("https://www.strava.com/oauth/deauthorize", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      revogado = res.ok;
    }
  } catch (e) {
    Sentry.captureException(e, { tags: { stage: "strava-deauthorize" }, extra: { athleteId: athlete.id } });
  }

  await prisma.athlete.update({
    where: { id: athlete.id },
    data: {
      stravaConnected: false,
      stravaAthleteId: null,
      stravaAccessToken: null,
      stravaRefreshToken: null,
      stravaTokenExpiry: null,
      stravaSyncError: null,
      stravaSyncErrorAt: null,
    },
  });

  return NextResponse.json({
    ok: true,
    revoked: revogado,
    message: revogado
      ? "Strava desligado. O acesso foi retirado também do lado do Strava."
      : "Strava desligado aqui. Confirma em strava.com/settings/apps que o TrainAI já não tem acesso.",
  });
}
