import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getStravaAuthUrl } from "@/lib/strava";

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const userId = cookieStore.get("user_id")?.value;
  if (!userId) return NextResponse.redirect(new URL("/auth/login", req.url));

  // state para verificar o callback
  const state = Buffer.from(userId).toString("base64");
  const authUrl = getStravaAuthUrl(state);

  return NextResponse.redirect(authUrl);
}
