import { describe, it, expect } from "vitest";

// Test the rate limiting logic directly, independent of Next.js
describe("Rate limiting middleware logic", () => {
  it("allows requests within the limit", async () => {
    const store = new Map<string, { count: number; resetAt: number }>();

    function checkLimit(key: string, max: number, windowMs: number): boolean {
      const now = Date.now();
      const entry = store.get(key);
      if (!entry || now > entry.resetAt) {
        store.set(key, { count: 1, resetAt: now + windowMs });
        return true; // allowed
      }
      entry.count++;
      return entry.count <= max;
    }

    const key = "127.0.0.1:/api/auth/login";
    for (let i = 0; i < 10; i++) {
      expect(checkLimit(key, 10, 60_000)).toBe(true);
    }
    // 11th request should be blocked
    expect(checkLimit(key, 10, 60_000)).toBe(false);
  });

  it("resets after the window expires", async () => {
    const store = new Map<string, { count: number; resetAt: number }>();

    function checkLimit(key: string, max: number, windowMs: number, now: number): boolean {
      const entry = store.get(key);
      if (!entry || now > entry.resetAt) {
        store.set(key, { count: 1, resetAt: now + windowMs });
        return true;
      }
      entry.count++;
      return entry.count <= max;
    }

    const key = "127.0.0.1:/api/test";
    const t0 = Date.now();

    // Fill up the limit
    for (let i = 0; i < 5; i++) checkLimit(key, 5, 1000, t0);
    expect(checkLimit(key, 5, 1000, t0)).toBe(false); // blocked

    // After window expires, should be allowed again
    const t1 = t0 + 2000;
    expect(checkLimit(key, 5, 1000, t1)).toBe(true);
  });
});

describe("Email validation", () => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  it("accepts valid emails", () => {
    expect(emailRegex.test("user@example.com")).toBe(true);
    expect(emailRegex.test("user+tag@example.co.uk")).toBe(true);
  });

  it("rejects invalid emails", () => {
    expect(emailRegex.test("not-an-email")).toBe(false);
    expect(emailRegex.test("@example.com")).toBe(false);
    expect(emailRegex.test("user@")).toBe(false);
  });
});

describe("TCX export helpers", () => {
  it("formats pace seconds correctly", () => {
    function secondsToPace(secs: number): string {
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      return `${m}:${String(s).padStart(2, "0")}`;
    }

    expect(secondsToPace(300)).toBe("5:00");
    expect(secondsToPace(330)).toBe("5:30");
    expect(secondsToPace(267)).toBe("4:27");
  });

  it("calculates HR zones from maxHR", () => {
    function hrZone(maxHR: number, zone: number) {
      const thresholds = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
      return {
        low: Math.round(maxHR * thresholds[zone - 1]),
        high: Math.round(maxHR * thresholds[zone]),
      };
    }

    const zones = hrZone(180, 2);
    expect(zones.low).toBe(108);
    expect(zones.high).toBe(126);

    const z4 = hrZone(180, 4);
    expect(z4.low).toBe(144);
    expect(z4.high).toBe(162);
  });
});
