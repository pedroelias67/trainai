import { prisma } from "@/lib/prisma";
import { isLocked, minutesLeft } from "@/lib/login-lock";
import { getSessionUserId } from "@/lib/session";

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "pedroelias67@gmail.com";

/** The signed-in user when they are the admin, otherwise null. */
export async function requireAdmin() {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.email !== ADMIN_EMAIL) return null;
  return user;
}

export type AccountStatus = {
  /** Cut off by the admin: cannot sign in, and signed out everywhere. */
  suspended: boolean;
  suspendedAt: Date | null;
  /** Browsers currently signed in. */
  activeSessions: number;
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
  suspendedAt: Date | null;
  _count: { sessions: number };
  emailVerified: boolean;
  verificationToken: string | null;
  failedLoginCount: number;
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
  passwordHash: string | null;
}): AccountStatus {
  return {
    suspended: !!u.suspendedAt,
    suspendedAt: u.suspendedAt,
    activeSessions: u._count.sessions,
    pendingVerification: !u.emailVerified && !!u.verificationToken,
    locked: isLocked(u),
    lockMinutesLeft: minutesLeft(u),
    failedLoginCount: u.failedLoginCount,
    lastLoginAt: u.lastLoginAt,
    hasPassword: !!u.passwordHash,
  };
}

/**
 * The columns `accountStatus` reads, for a Prisma `select`. A function, because
 * "active" sessions are those unexpired as of this request, not as of boot.
 */
export const accountStatusSelect = () => ({
  suspendedAt: true,
  _count: { select: { sessions: { where: { expires: { gt: new Date() } } } } },
  emailVerified: true,
  verificationToken: true,
  failedLoginCount: true,
  lockedUntil: true,
  lastLoginAt: true,
  passwordHash: true,
} as const);
