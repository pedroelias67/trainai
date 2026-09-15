import { describe, it, expect, vi, beforeEach } from "vitest";

const db = vi.hoisted(() => ({ athlete: { update: vi.fn() } }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

const session = vi.hoisted(() => ({ userId: null as string | null }));
vi.mock("@/lib/session", () => ({ getSessionUserId: vi.fn(async () => session.userId) }));

vi.mock("@/lib/strava", async () => {
  const actual = await vi.importActual<typeof import("@/lib/strava")>("@/lib/strava");
  return {
    ...actual,
    exchangeStravaCode: vi.fn(async () => ({
      access_token: "at", refresh_token: "rt", expires_at: 2_000_000_000, athlete: { id: 999 },
    })),
  };
});

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return {
    ...actual,
    NextResponse: {
      redirect: (url: URL) => {
        const res = new Response(null, { status: 307, headers: { location: url.toString() } });
        return Object.assign(res, { cookies: { delete: vi.fn(), set: vi.fn() } });
      },
    },
  };
});

function callback(state: string, cookieState?: string) {
  const req = new Request(`https://trainai.test/api/strava/callback?code=c&state=${encodeURIComponent(state)}`);
  return Object.assign(req, {
    cookies: { get: (name: string) => (name === "strava_oauth_state" && cookieState ? { value: cookieState } : undefined) },
  });
}

describe("Strava OAuth callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    session.userId = "victim";
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true })));
  });

  it("will not link a Strava account through a state naming someone's id", async () => {
    // The old attack: state was base64(userId) and was believed, so an attacker
    // who knew an id could attach their own Strava to that account.
    session.userId = null;
    const { GET } = await import("@/app/api/strava/callback/route");
    const forged = Buffer.from("victim").toString("base64");

    const res = await GET(callback(forged) as never);
    expect(res.headers.get("location")).toContain("strava=error");
    expect(db.athlete.update).not.toHaveBeenCalled();
  });

  it("refuses a reply that does not match the state this browser was given", async () => {
    const { GET } = await import("@/app/api/strava/callback/route");
    const res = await GET(callback("attacker-state", "my-state") as never);
    expect(res.headers.get("location")).toContain("strava=error");
    expect(db.athlete.update).not.toHaveBeenCalled();
  });

  it("links the signed-in athlete when the state matches", async () => {
    const { GET } = await import("@/app/api/strava/callback/route");
    const res = await GET(callback("my-state", "my-state") as never);
    expect(res.headers.get("location")).toContain("strava=connected");
    expect(db.athlete.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "victim" },
      data: expect.objectContaining({ stravaAthleteId: "999", stravaSyncError: null }),
    }));
  });
});
