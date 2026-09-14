export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getStravaAuthUrl } from "@/lib/strava";
import { getSessionUserId } from "@/lib/session";

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.redirect(new URL("/auth/login", req.url));

  // state para verificar o callback
  const state = Buffer.from(userId).toString("base64");
  const authUrl = getStravaAuthUrl(state);

  return NextResponse.redirect(authUrl);
}
