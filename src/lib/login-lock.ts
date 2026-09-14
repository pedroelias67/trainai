// Account lockout after repeated wrong passwords.
//
// Kept on the user row, not in server memory. Vercel runs several instances,
// so an in-memory lock was held by whichever one happened to take the requests:
// the athlete could be locked on one and not another, and an admin clearing it
// would usually be talking to a different instance altogether.

export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;

export type LockState = { failedLoginCount: number; lockedUntil: Date | null };

export function isLocked(state: LockState, now = new Date()): boolean {
  return !!state.lockedUntil && state.lockedUntil > now;
}

/** Minutes left on a lock, rounded up so "0 minutes" is never shown. */
export function minutesLeft(state: LockState, now = new Date()): number {
  if (!state.lockedUntil) return 0;
  return Math.max(Math.ceil((state.lockedUntil.getTime() - now.getTime()) / 60000), 0);
}

/**
 * The state after a wrong password. The count restarts once a lock has run its
 * course, so an athlete who waited out the lock gets their full five tries back
 * rather than being locked again on the very next slip.
 */
export function afterFailure(state: LockState, now = new Date()): LockState {
  const expired = !!state.lockedUntil && state.lockedUntil <= now;
  const count = (expired ? 0 : state.failedLoginCount) + 1;
  if (count >= MAX_FAILED_LOGINS) {
    return { failedLoginCount: 0, lockedUntil: new Date(now.getTime() + LOCK_MINUTES * 60000) };
  }
  return { failedLoginCount: count, lockedUntil: expired ? null : state.lockedUntil };
}

/** A right password, or an admin unlocking the account. */
export const cleared: LockState = { failedLoginCount: 0, lockedUntil: null };
