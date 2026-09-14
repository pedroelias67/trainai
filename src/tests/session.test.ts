import { describe, it, expect, vi, beforeEach } from "vitest";

const jar = vi.hoisted(() => {
  const values = new Map<string, string>();
  return {
    values,
    store: {
      get: vi.fn((name: string) => (values.has(name) ? { value: values.get(name)! } : undefined)),
      set: vi.fn((name: string, value: string) => { values.set(name, value); }),
      delete: vi.fn((name: string) => { values.delete(name); }),
    },
  };
});
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => jar.store) }));

const db = vi.hoisted(() => ({
  session: { create: vi.fn(), deleteMany: vi.fn(async () => ({ count: 0 })), findUnique: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

import {
  createSession, destroySession, getSessionUserId, hashToken, revokeAllSessions,
  SESSION_COOKIE, LEGACY_COOKIE,
} from "@/lib/session";

const future = () => new Date(Date.now() + 60_000);

describe("sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    jar.values.clear();
  });

  it("gives the browser a random token and stores only its hash", async () => {
    await createSession("user-1", "Safari");
    const token = jar.values.get(SESSION_COOKIE)!;
    const { data } = db.session.create.mock.calls[0][0];

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(token).not.toContain("user-1");
    expect(data.sessionToken).toBe(hashToken(token));
    expect(data.sessionToken).not.toBe(token);
  });

  it("clears the old cookie when a session is created", async () => {
    jar.values.set(LEGACY_COOKIE, "user-1");
    await createSession("user-1");
    expect(jar.values.has(LEGACY_COOKIE)).toBe(false);
  });

  it("recognises a session it issued", async () => {
    jar.values.set(SESSION_COOKIE, "tok");
    db.session.findUnique.mockResolvedValue({ userId: "user-1", expires: future(), user: { suspendedAt: null } });

    expect(await getSessionUserId()).toBe("user-1");
    expect(db.session.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { sessionToken: hashToken("tok") } })
    );
  });

  it("does not trust the old cookie: an id is not a session", async () => {
    // What the fix is for. Setting user_id to someone's id used to sign you in as them.
    jar.values.set(LEGACY_COOKIE, "admin-user-id");
    expect(await getSessionUserId()).toBeNull();
    expect(db.session.findUnique).not.toHaveBeenCalled();
  });

  it("refuses an unknown, expired or suspended session", async () => {
    jar.values.set(SESSION_COOKIE, "tok");

    db.session.findUnique.mockResolvedValue(null);
    expect(await getSessionUserId()).toBeNull();

    db.session.findUnique.mockResolvedValue({ userId: "u", expires: new Date(Date.now() - 1), user: { suspendedAt: null } });
    expect(await getSessionUserId()).toBeNull();

    db.session.findUnique.mockResolvedValue({ userId: "u", expires: future(), user: { suspendedAt: new Date() } });
    expect(await getSessionUserId()).toBeNull();
  });

  it("signing out deletes the session row, so a copied cookie stops working too", async () => {
    jar.values.set(SESSION_COOKIE, "tok");
    await destroySession();
    expect(db.session.deleteMany).toHaveBeenCalledWith({ where: { sessionToken: hashToken("tok") } });
    expect(jar.values.has(SESSION_COOKIE)).toBe(false);
  });

  it("revokes every session of a user", async () => {
    db.session.deleteMany.mockResolvedValueOnce({ count: 3 });
    expect(await revokeAllSessions("user-1")).toBe(3);
    expect(db.session.deleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
  });
});
