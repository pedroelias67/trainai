export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import * as Sentry from "@sentry/nextjs";
import { createSession } from "@/lib/session";
import { sendWelcomeEmail } from "@/lib/email";

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const savedState = cookieStore.get("oauth_state")?.value;

  if (!code || state !== savedState) {
    return NextResponse.redirect(new URL("/auth/login?error=oauth_failed", req.url));
  }

  const redirectUri = `${process.env.NEXTAUTH_URL ?? "https://trainai.pedroelias.com"}/api/auth/google/callback`;

  // Exchange code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code, client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri, grant_type: "authorization_code",
    }),
  });
  const tokens = await tokenRes.json();
  if (!tokens.access_token) return NextResponse.redirect(new URL("/auth/login?error=oauth_failed", req.url));

  // Get user info
  const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const googleUser = await userInfoRes.json();
  if (!googleUser.email) return NextResponse.redirect(new URL("/auth/login?error=oauth_failed", req.url));

  // Find or create user
  let user = await prisma.user.findUnique({ where: { email: googleUser.email } });

  if (!user) {
    // Signing up through Google skipped the invite check that email sign-up
    // enforces, so on an invite-only deployment anyone with a Google account
    // could create one. A new account needs a pending invite for this address.
    const invite = process.env.INVITE_ONLY === "true"
      ? await prisma.invite.findFirst({
          where: {
            email: { equals: googleUser.email, mode: "insensitive" },
            usedAt: null,
            expiresAt: { gt: new Date() },
          },
        })
      : null;
    if (process.env.INVITE_ONLY === "true" && !invite) {
      cookieStore.delete("oauth_state");
      return NextResponse.redirect(new URL("/auth/login?error=invite_required", req.url));
    }

    user = await prisma.user.create({
      data: {
        email: googleUser.email,
        name: googleUser.name,
        image: googleUser.picture,
        emailVerified: true, // Google already verified
        athlete: { create: {} },
      },
    });
    // Link Google account
    await prisma.account.create({
      data: {
        userId: user.id, type: "oauth", provider: "google",
        providerAccountId: googleUser.id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? null,
      },
    });
    if (invite) {
      await prisma.invite.update({
        where: { id: invite.id },
        data: { usedAt: new Date(), usedByUserId: user.id },
      });
    }
    try {
      await sendWelcomeEmail(user.email, user.name ?? "atleta");
    } catch (e) {
      Sentry.captureException(e, { tags: { stage: "google-welcome" } });
    }
  } else if (!user.emailVerified) {
    // Mark as verified since Google confirmed the email
    await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });
  }

  if (user.suspendedAt) {
    cookieStore.delete("oauth_state");
    return NextResponse.redirect(new URL("/auth/login?error=suspended", req.url));
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  await createSession(user.id, req.headers.get("user-agent"));
  cookieStore.delete("oauth_state");

  // Check if athlete profile exists
  const athlete = await prisma.athlete.findUnique({ where: { userId: user.id } });
  if (!athlete) return NextResponse.redirect(new URL("/onboarding", req.url));

  return NextResponse.redirect(new URL("/dashboard", req.url));
}
