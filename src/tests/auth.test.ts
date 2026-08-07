import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";

const mockPrisma = prisma as unknown as {
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
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

describe("Rate limiting", () => {
  it("blocks after 5 failed attempts for the same email", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const { POST } = await import("@/app/api/auth/login/route");
    const email = `ratelimit_${Date.now()}@test.com`;

    // 5 attempts should pass through to 401
    for (let i = 0; i < 5; i++) {
      const res = await POST(makeRequest({ email, password: "pwd" }) as never);
      expect(res.status).toBe(401);
    }

    // 6th attempt should be rate limited
    const res = await POST(makeRequest({ email, password: "pwd" }) as never);
    expect(res.status).toBe(429);
  });
});
