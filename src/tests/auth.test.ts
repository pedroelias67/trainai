import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";

const mockPrisma = prisma as unknown as {
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

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
      athlete: { id: "athlete-1" },
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
      athlete: { id: "athlete-1" },
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
    athlete: { id: "athlete-1" },
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
