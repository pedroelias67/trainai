import { vi } from "vitest";

// Mock Next.js server modules not available in Node test environment
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  })),
}));

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return {
    ...actual,
    NextResponse: {
      json: (data: unknown, init?: ResponseInit) =>
        new Response(JSON.stringify(data), {
          ...init,
          headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
        }),
      next: () => new Response(null, { status: 200 }),
    },
  };
});

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    athlete: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    trainingSession: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Mock bcryptjs
vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn(async (pwd: string) => `hashed_${pwd}`),
    compare: vi.fn(async (pwd: string, hash: string) => hash === `hashed_${pwd}`),
  },
}));
