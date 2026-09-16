import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";

const mockPrisma = prisma as unknown as {
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  session: {
    create: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
  };
};

/** An athlete row shaped as the login route asks for it. */
function athleteWith(events: number, trainingPlans: number) {
  return { id: "athlete-1", _count: { events, trainingPlans } };
}

// Helper to make a fake POST request
function makeRequest(body: unknown) {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 for unknown email", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const { POST } = await import("@/app/api/auth/login/route");
    const res = await POST(makeRequest({ email: "unknown@test.com", password: "password123" }) as never);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Credenciais inválidas");
  });

  it("returns 401 for wrong password", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "test@test.com",
      passwordHash: "hashed_correct_password",
      emailVerified: true,
      verificationToken: null,
      athlete: athleteWith(1, 1),
    });

    const { POST } = await import("@/app/api/auth/login/route");
    const res = await POST(makeRequest({ email: "test@test.com", password: "wrong_password" }) as never);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Credenciais inválidas");
  });

  it("returns 200 for valid credentials", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "test@test.com",
      passwordHash: "hashed_correct_password",
      emailVerified: true,
      verificationToken: null,
      athlete: athleteWith(1, 1),
    });

    const { POST } = await import("@/app/api/auth/login/route");
    const res = await POST(makeRequest({ email: "test@test.com", password: "correct_password" }) as never);

    expect(res.status).toBe(200);
  });

  it("returns 400 for invalid email format", async () => {
    const { POST } = await import("@/app/api/auth/login/route");
    const res = await POST(makeRequest({ email: "not-an-email", password: "password123" }) as never);

    expect(res.status).toBe(400);
  });
});

describe("Account lockout", () => {
  // The lock lives on the user row, so these assert what gets written there
  // rather than relying on state held between requests.
  const user = (over: Record<string, unknown> = {}) => ({
    id: "user-1",
    email: "test@test.com",
    passwordHash: "hashed_correct_password",
    emailVerified: true,
    verificationToken: null,
    failedLoginCount: 0,
    lockedUntil: null,
    athlete: athleteWith(1, 1),
    ...over,
  });

  beforeEach(() => vi.clearAllMocks());

  it("records a wrong password against the account", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(user({ failedLoginCount: 2 }));
    const { POST } = await import("@/app/api/auth/login/route");

    const res = await POST(makeRequest({ email: "test@test.com", password: "wrong_password" }) as never);
    expect(res.status).toBe(401);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { failedLoginCount: 3, lockedUntil: null } })
    );
  });

  it("locks on the fifth wrong password", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(user({ failedLoginCount: 4 }));
    const { POST } = await import("@/app/api/auth/login/route");

    await POST(makeRequest({ email: "test@test.com", password: "wrong_password" }) as never);
    const { data } = mockPrisma.user.update.mock.calls[0][0];
    expect(data.lockedUntil.getTime()).toBeGreaterThan(Date.now());
  });

  it("refuses a locked account even with the right password", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(user({ lockedUntil: new Date(Date.now() + 10 * 60000) }));
    const { POST } = await import("@/app/api/auth/login/route");

    const res = await POST(makeRequest({ email: "test@test.com", password: "correct_password" }) as never);
    expect(res.status).toBe(429);
    expect((await res.json()).error).toMatch(/10 minutos/);
  });

  it("does not count a right password waiting on email confirmation", async () => {
    // How the first invited friend locked themselves out: checking whether the
    // confirmation had arrived, with the right password, five times.
    mockPrisma.user.findUnique.mockResolvedValue(user({ emailVerified: false, verificationToken: "t" }));
    const { POST } = await import("@/app/api/auth/login/route");

    const res = await POST(makeRequest({ email: "test@test.com", password: "correct_password" }) as never);
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("EMAIL_NOT_VERIFIED");
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("clears earlier wrong passwords on a successful login", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(user({ failedLoginCount: 3 }));
    const { POST } = await import("@/app/api/auth/login/route");

    const res = await POST(makeRequest({ email: "test@test.com", password: "correct_password" }) as never);
    expect(res.status).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { failedLoginCount: 0, lockedUntil: null } })
    );
  });
});

describe("Sessions on login", () => {
  const user = (over: Record<string, unknown> = {}) => ({
    id: "user-1", email: "test@test.com", passwordHash: "hashed_correct_password",
    emailVerified: true, verificationToken: null, failedLoginCount: 0, lockedUntil: null,
    suspendedAt: null, athlete: athleteWith(1, 1), ...over,
  });

  beforeEach(() => vi.clearAllMocks());

  it("opens a session whose stored token is not the user's id", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(user());
    const { POST } = await import("@/app/api/auth/login/route");

    const res = await POST(makeRequest({ email: "test@test.com", password: "correct_password" }) as never);
    expect(res.status).toBe(200);
    const { data } = mockPrisma.session.create.mock.calls[0][0];
    expect(data.userId).toBe("user-1");
    expect(data.sessionToken).toMatch(/^[0-9a-f]{64}$/); // a SHA-256, not an id
  });

  it("refuses a suspended account, and opens no session for it", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(user({ suspendedAt: new Date() }));
    const { POST } = await import("@/app/api/auth/login/route");

    const res = await POST(makeRequest({ email: "test@test.com", password: "correct_password" }) as never);
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("SUSPENDED");
    expect(mockPrisma.session.create).not.toHaveBeenCalled();
  });

  it("says nothing about suspension to someone with the wrong password", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(user({ suspendedAt: new Date() }));
    const { POST } = await import("@/app/api/auth/login/route");

    const res = await POST(makeRequest({ email: "test@test.com", password: "wrong_password" }) as never);
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBeUndefined();
  });
});

describe("Where login sends people", () => {
  const user = (athlete: unknown) => ({
    id: "user-1", email: "test@test.com", passwordHash: "hashed_correct_password",
    emailVerified: true, verificationToken: null, failedLoginCount: 0, lockedUntil: null,
    suspendedAt: null, athlete,
  });

  beforeEach(() => vi.clearAllMocks());

  async function redirectFor(athlete: unknown) {
    mockPrisma.user.findUnique.mockResolvedValue(user(athlete));
    const { POST } = await import("@/app/api/auth/login/route");
    const res = await POST(makeRequest({ email: "test@test.com", password: "correct_password" }) as never);
    return (await res.json()).redirectTo;
  }

  it("takes someone who set nothing up to the onboarding", async () => {
    // The old test was "does the athlete have a fitness level", which has a
    // default and so was true for everyone, empty account included.
    expect(await redirectFor(athleteWith(0, 0))).toBe("/onboarding");
  });

  it("takes everyone else to the dashboard", async () => {
    expect(await redirectFor(athleteWith(1, 0))).toBe("/dashboard");
    expect(await redirectFor(athleteWith(0, 1))).toBe("/dashboard");
    expect(await redirectFor(athleteWith(2, 3))).toBe("/dashboard");
  });
});
