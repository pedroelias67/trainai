// Signed-in sessions.
//
// The session used to be the user's id, as it stands, in a cookie. Nothing
// proved the server had issued it, so anyone who learned an id — the admin's
// included — could set that cookie and be that person. And there was nothing to
// revoke: an account could not be cut off, only deleted.
//
// Now the cookie carries a random token, and the Session table holds its SHA-256.
// A session exists only because the server wrote that row, lasts until it
// expires or is deleted, and is refused the moment its account is suspended.

import { cache } from "react";
import { cookies } from "next/headers";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export const SESSION_COOKIE = "trainai_session";
/** The old cookie. Never trusted — only cleared wherever it is still found. */
export const LEGACY_COOKIE = "user_id";
export const SESSION_DAYS = 7;

/** Only this is stored: the table alone is not enough to sign in as anyone. */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string, userAgent?: string | null): Promise<void> {
  const token = crypto.randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.deleteMany({ where: { userId, expires: { lt: new Date() } } });
  await prisma.session.create({
    data: {
      sessionToken: hashToken(token),
      userId,
      expires,
      userAgent: userAgent ? userAgent.slice(0, 200) : null,
    },
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires,
    path: "/",
  });
  store.delete(LEGACY_COOKIE);
}

/**
 * The signed-in user's id, or null.
 *
 * Null as well when the session has expired or its account is suspended, so
 * every page and route that asks this question enforces both. Memoised per
 * request, since a page and the components under it may each ask.
 */
export const getSessionUserId = cache(async (): Promise<string | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { sessionToken: hashToken(token) },
    select: { userId: true, expires: true, user: { select: { suspendedAt: true } } },
  });
  if (!session || session.expires <= new Date() || session.user.suspendedAt) return null;
  return session.userId;
});

/** Signs this browser out. */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { sessionToken: hashToken(token) } });
  store.delete(SESSION_COOKIE);
  store.delete(LEGACY_COOKIE);
}

/** Signs a user out everywhere. Returns how many sessions were ended. */
export async function revokeAllSessions(userId: string): Promise<number> {
  const { count } = await prisma.session.deleteMany({ where: { userId } });
  return count;
}

export const SUSPENDED_MESSAGE = "Esta conta está suspensa. Fala com o administrador.";
