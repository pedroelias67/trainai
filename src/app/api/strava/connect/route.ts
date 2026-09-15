export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getStravaAuthUrl, STRAVA_STATE_COOKIE } from "@/lib/strava";
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
