import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { isLocked, minutesLeft } from "@/lib/login-lock";

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "pedroelias67@gmail.com";

/** The signed-in user when they are the admin, otherwise null. */
export async function requireAdmin() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("user_id")?.value;
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.email !== ADMIN_EMAIL) return null;
  return user;
}

export type AccountStatus = {
  /** Waiting on the confirmation email, and therefore unable to sign in. */
  pendingVerification: boolean;
  locked: boolean;
  lockMinutesLeft: number;
  failedLoginCount: number;
  lastLoginAt: Date | null;
  hasPassword: boolean;
};

/**
 * What the admin needs to know about whether someone can get in — and nothing
 * that would let anyone else: no password hash, no token, only whether they
 * exist. The login route blocks on the same condition used here.
 */
export function accountStatus(u: {
  emailVerified: boolean;
  verificationToken: string | null;
  failedLoginCount: number;
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
  passwordHash: string | null;
}): AccountStatus {
  return {
    pendingVerification: !u.emailVerified && !!u.verificationToken,
    locked: isLocked(u),
    lockMinutesLeft: minutesLeft(u),
    failedLoginCount: u.failedLoginCount,
    lastLoginAt: u.lastLoginAt,
    hasPassword: !!u.passwordHash,
  };
}

/** The columns `accountStatus` reads, for a Prisma `select`. */
export const accountStatusSelect = {
  emailVerified: true,
  verificationToken: true,
  failedLoginCount: true,
  lockedUntil: true,
  lastLoginAt: true,
  passwordHash: true,
} as const;
