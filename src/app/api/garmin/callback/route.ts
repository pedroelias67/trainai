export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const userId = cookieStore.get("user_id")?.value;
  if (!userId) return NextResponse.redirect(new URL("/auth/login", req.url));

  const { searchParams } = new URL(req.url);
  const oauthToken = searchParams.get("oauth_token");
  const oauthVerifier = searchParams.get("oauth_verifier");

  if (!oauthToken || !oauthVerifier) {
    return NextResponse.redirect(new URL("/dashboard?garmin=error", req.url));
  }

  try {
    // Trocar o token temporário por tokens de acesso permanentes
    const tokenRes = await fetch("https://connectapi.garmin.com/oauth-service/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: buildOAuthHeader({
          oauth_consumer_key: process.env.GARMIN_CLIENT_ID!,
          oauth_token: oauthToken,
          oauth_verifier: oauthVerifier,
        }),
      },
    });

    if (!tokenRes.ok) throw new Error("Falha ao obter token Garmin");

    const tokenText = await tokenRes.text();
    const params = new URLSearchParams(tokenText);
    const accessToken = params.get("oauth_token");
    const accessSecret = params.get("oauth_token_secret");
    const garminUserId = params.get("xoauth_user_id");

    if (!accessToken || !garminUserId) throw new Error("Tokens inválidos");

    await prisma.athlete.update({
      where: { userId },
      data: {
        garminConnected: true,
        garminUserId,
        // Em produção, guardar accessToken encriptado
      },
    });

    return NextResponse.redirect(new URL("/dashboard?garmin=connected", req.url));
  } catch (err) {
    console.error("Garmin callback error:", err);
    return NextResponse.redirect(new URL("/dashboard?garmin=error", req.url));
  }
}

function buildOAuthHeader(params: Record<string, string>): string {
  const entries = Object.entries(params)
    .map(([k, v]) => `${k}="${encodeURIComponent(v)}"`)
    .join(", ");
  return `OAuth ${entries}`;
}
