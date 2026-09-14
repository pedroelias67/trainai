import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// This route redirects rather than answering JSON, reads the OAuth state cookie
// and calls Google, so it needs more than the shared setup provides.
const cookieStore = { get: vi.fn(() => ({ value: "state-1" })), set: vi.fn(), delete: vi.fn() };
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => cookieStore) }));

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return {
    ...actual,
    NextResponse: {
      redirect: (url: URL) => new Response(null, { status: 307, headers: { location: url.toString() } }),
      json: (data: unknown, init?: ResponseInit) => new Response(JSON.stringify(data), init),
    },
  };
});

const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  account: { create: vi.fn() },
  athlete: { findUnique: vi.fn() },
  invite: { findFirst: vi.fn(), update: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/email", () => ({ sendWelcomeEmail: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

function callback() {
  const req = new Request("https://trainai.test/api/auth/google/callback?code=c&state=state-1");
  return Object.assign(req, { nextUrl: new URL(req.url) });
}

describe("Google sign-up on an invite-only deployment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("INVITE_ONLY", "true");
    vi.stubGlobal("fetch", vi.fn(async (url: string) => ({
      json: async () => url.includes("token")
        ? { access_token: "at" }
        : { id: "g1", email: "stranger@gmail.com", name: "Stranger" },
    })));
    db.user.findUnique.mockResolvedValue(null);
    db.user.create.mockResolvedValue({ id: "u1", email: "stranger@gmail.com", name: "Stranger" });
    db.athlete.findUnique.mockResolvedValue({ id: "a1" });
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("creates nothing for an address with no invite", async () => {
    // Before, anyone with a Google account got an account here.
    db.invite.findFirst.mockResolvedValue(null);
    const { GET } = await import("@/app/api/auth/google/callback/route");

    const res = await GET(callback() as never);
    expect(res.headers.get("location")).toContain("error=invite_required");
    expect(db.user.create).not.toHaveBeenCalled();
    expect(cookieStore.set).not.toHaveBeenCalled();
  });

  it("creates the account and uses up the invite when one is waiting", async () => {
    db.invite.findFirst.mockResolvedValue({ id: "inv1" });
    const { GET } = await import("@/app/api/auth/google/callback/route");

    const res = await GET(callback() as never);
    expect(res.headers.get("location")).not.toContain("error");
    expect(db.user.create).toHaveBeenCalled();
    expect(db.invite.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "inv1" }, data: expect.objectContaining({ usedByUserId: "u1" }) })
    );
  });

  it("still lets existing users sign in", async () => {
    db.user.findUnique.mockResolvedValue({ id: "u1", email: "stranger@gmail.com", emailVerified: true });
    const { GET } = await import("@/app/api/auth/google/callback/route");

    const res = await GET(callback() as never);
    expect(res.headers.get("location")).toContain("/dashboard");
    expect(db.invite.findFirst).not.toHaveBeenCalled();
  });

  it("asks for no invite when sign-up is open", async () => {
    vi.stubEnv("INVITE_ONLY", "false");
    const { GET } = await import("@/app/api/auth/google/callback/route");

    await GET(callback() as never);
    expect(db.invite.findFirst).not.toHaveBeenCalled();
    expect(db.user.create).toHaveBeenCalled();
  });
});
