import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const db = vi.hoisted(() => ({
  athlete: { update: vi.fn(), updateMany: vi.fn(), findFirst: vi.fn(), findUniqueOrThrow: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { getValidStravaToken, isDeauthorization, REVOKED_MESSAGE, recordStravaSync } from "@/lib/strava-connection";
import { StravaAuthError } from "@/lib/strava";

const athlete = (expiresInMs: number) => ({
  id: "a1", stravaAccessToken: "old-access", stravaRefreshToken: "old-refresh",
  stravaTokenExpiry: new Date(Date.now() + expiresInMs),
});

describe("getValidStravaToken", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it("uses the stored token while it has time left", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(await getValidStravaToken(athlete(60 * 60 * 1000))).toBe("old-access");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("refreshes a token about to lapse, and saves the new refresh token", async () => {
    // Strava may rotate the refresh token. Using a new one without storing it
    // would leave the athlete unable to sync at all.
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => ({ access_token: "new-access", refresh_token: "new-refresh", expires_at: 2_000_000_000 }),
    })));
    expect(await getValidStravaToken(athlete(60 * 1000))).toBe("new-access");
    expect(db.athlete.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ stravaAccessToken: "new-access", stravaRefreshToken: "new-refresh" }),
    }));
  });

  it("recognises Strava refusing the grant", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 400, json: async () => ({}) })));
    await expect(getValidStravaToken(athlete(-1000))).rejects.toBeInstanceOf(StravaAuthError);
    expect(db.athlete.update).not.toHaveBeenCalled();
  });
});

describe("recordStravaSync", () => {
  beforeEach(() => vi.clearAllMocks());

  it("clears the error on success, and describes a refusal plainly", async () => {
    await recordStravaSync("a1", null);
    expect(db.athlete.update.mock.calls[0][0].data).toMatchObject({ stravaSyncError: null });
    await recordStravaSync("a1", new StravaAuthError(401));
    expect(db.athlete.update.mock.calls[1][0].data).toMatchObject({ stravaSyncError: REVOKED_MESSAGE });
  });
});

describe("isDeauthorization", () => {
  it("goes by the authorized flag, whatever the aspect", () => {
    expect(isDeauthorization({ object_type: "athlete", updates: { authorized: "false" } })).toBe(true);
    expect(isDeauthorization({ object_type: "athlete", updates: { authorized: false } })).toBe(true);
    expect(isDeauthorization({ object_type: "activity", updates: { title: "Messy" } })).toBe(false);
    expect(isDeauthorization({ object_type: "athlete", updates: {} })).toBe(false);
  });
});

describe("Strava webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });
  afterEach(() => vi.unstubAllGlobals());

  async function post(event: unknown) {
    vi.doMock("next/server", async () => {
      const actual = await vi.importActual<typeof import("next/server")>("next/server");
      const pending: Promise<unknown>[] = [];
      return {
        ...actual,
        // Run the deferred work inline so the test can see its effects.
        after: (fn: () => Promise<unknown>) => { pending.push(fn()); },
        NextResponse: { json: (d: unknown) => new Response(JSON.stringify(d)) },
        __pending: pending,
      };
    });
    const { POST } = await import("@/app/api/strava/webhook/route");
    const server = (await import("next/server")) as unknown as { __pending: Promise<unknown>[] };
    const res = await POST(new Request("https://x/api/strava/webhook", { method: "POST", body: JSON.stringify(event) }) as never);
    await Promise.all(server.__pending);
    return res;
  }

  const deauth = { object_type: "athlete", aspect_type: "update", owner_id: 42, updates: { authorized: "false" } };

  it("answers straight away, before any work", async () => {
    db.athlete.findFirst.mockResolvedValue(null);
    expect((await post(deauth)).status).toBe(200);
  });

  it("ignores a forged deauthorization while the athlete's link still works", async () => {
    // Strava does not sign events: anyone can post this for any athlete id.
    db.athlete.findFirst.mockResolvedValue({ id: "a1" });
    db.athlete.findUniqueOrThrow.mockResolvedValue(athlete(60 * 60 * 1000));
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })));

    await post(deauth);
    expect(db.athlete.updateMany).not.toHaveBeenCalled();
  });

  it("drops the link when Strava confirms it was revoked", async () => {
    db.athlete.findFirst.mockResolvedValue({ id: "a1" });
    db.athlete.findUniqueOrThrow.mockResolvedValue(athlete(60 * 60 * 1000));
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) })));

    await post(deauth);
    expect(db.athlete.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { stravaAthleteId: "42" },
      data: expect.objectContaining({ stravaConnected: false, stravaAccessToken: null }),
    }));
  });
});
