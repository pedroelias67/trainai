import { describe, it, expect } from "vitest";
import { afterFailure, cleared, isLocked, minutesLeft, MAX_FAILED_LOGINS, LOCK_MINUTES } from "@/lib/login-lock";
import { accountStatus } from "@/lib/admin";

const now = new Date("2026-09-14T10:00:00Z");
const mins = (n: number) => new Date(now.getTime() + n * 60000);

describe("afterFailure", () => {
  it("counts wrong passwords up to the limit, then locks", () => {
    let state = cleared;
    for (let i = 1; i < MAX_FAILED_LOGINS; i++) {
      state = afterFailure(state, now);
      expect(state.failedLoginCount).toBe(i);
      expect(isLocked(state, now)).toBe(false);
    }
    state = afterFailure(state, now);
    expect(isLocked(state, now)).toBe(true);
    expect(minutesLeft(state, now)).toBe(LOCK_MINUTES);
  });

  it("gives the full tries back once a lock has run out", () => {
    const expired = { failedLoginCount: 0, lockedUntil: mins(-1) };
    expect(afterFailure(expired, now)).toEqual({ failedLoginCount: 1, lockedUntil: null });
  });
});

describe("minutesLeft", () => {
  it("rounds up, so a lock never reads as 0 minutes", () => {
    expect(minutesLeft({ failedLoginCount: 0, lockedUntil: new Date(now.getTime() + 20_000) }, now)).toBe(1);
    expect(minutesLeft(cleared, now)).toBe(0);
  });
});

describe("accountStatus", () => {
  const base = {
    emailVerified: true, verificationToken: null, failedLoginCount: 0,
    lockedUntil: null, lastLoginAt: null, passwordHash: "hash",
  };

  it("flags an account waiting on its confirmation email", () => {
    // The state the first invited friend was stuck in, invisible to the admin.
    expect(accountStatus({ ...base, emailVerified: false, verificationToken: "t" }).pendingVerification).toBe(true);
  });

  it("does not flag accounts from before confirmation existed", () => {
    // The login route only blocks when a token is set; so must this.
    expect(accountStatus({ ...base, emailVerified: false }).pendingVerification).toBe(false);
  });

  it("never carries the hash or the token", () => {
    const out = accountStatus({ ...base, verificationToken: "secret-token", passwordHash: "secret-hash" });
    expect(JSON.stringify(out)).not.toMatch(/secret/);
    expect(out.hasPassword).toBe(true);
  });
});
