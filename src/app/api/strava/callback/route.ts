export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exchangeStravaCode, STRAVA_STATE_COOKIE } from "@/lib/strava";
import { getSessionUserId } from "@/lib/session";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code || !state) {
    return NextResponse.redirect(new URL("/dashboard?strava=denied", req.url));
  }

  // The reply must come back to the browser that asked for it, signed in as the
  // person who asked. Which account to link comes from the session, never from
  // anything in the URL.
  const savedState = req.cookies.get(STRAVA_STATE_COOKIE)?.value;
  const userId = await getSessionUserId();
  if (!savedState || state !== savedState || !userId) {
    return NextResponse.redirect(new URL("/dashboard?strava=error", req.url));
  }

  try {

    const tokens = await exchangeStravaCode(code);

    await prisma.athlete.update({
      where: { userId },
      data: {
        stravaConnected: true,
        stravaAthleteId: String(tokens.athlete.id),
        stravaAccessToken: tokens.access_token,
        stravaRefreshToken: tokens.refresh_token,
        stravaTokenExpiry: new Date(tokens.expires_at * 1000),
        // A fresh link supersedes whatever went wrong with the old one.
        stravaSyncError: null,
        stravaSyncErrorAt: null,
      },
    });

    // Subscrever webhook Strava para receber atividades automaticamente
    await subscribeStravaWebhook();

    const res = NextResponse.redirect(new URL("/dashboard?strava=connected", req.url));
    res.cookies.delete({ name: STRAVA_STATE_COOKIE, path: "/api/strava" });
    return res;
  } catch (err) {
    console.error("Strava callback error:", err);
    return NextResponse.redirect(new URL("/dashboard?strava=error", req.url));
  }
}

async function subscribeStravaWebhook() {
  try {
    const callbackUrl = `${process.env.NEXTAUTH_URL}/api/strava/webhook`;
    const verifyToken = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN ?? "trainai_webhook";

    await fetch("https://www.strava.com/api/v3/push_subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        callback_url: callbackUrl,
        verify_token: verifyToken,
      }),
    });
  } catch {
    // Webhook já pode estar subscrito — não é erro crítico
  }
}
