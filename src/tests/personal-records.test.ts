import { describe, it, expect } from "vitest";
import { riegelTime, canProject, formatPace } from "@/lib/personal-records";

describe("riegelTime", () => {
  it("returns the same time for the same distance", () => {
    expect(riegelTime(5000, 1200, 5000)).toBeCloseTo(1200, 5);
  });

  it("projects a slower pace over a longer distance", () => {
    // A 20:00 5K projects to roughly 41:35 over 10K — slower per km, as expected.
    const tenK = riegelTime(5000, 20 * 60, 10000);
    expect(tenK).toBeGreaterThan(40 * 60);
    expect(tenK).toBeLessThan(43 * 60);
    expect(tenK / 10).toBeGreaterThan((20 * 60) / 5);
  });
});

describe("canProject", () => {
  it("allows projections within a sane multiple", () => {
    expect(canProject(5000, 5000)).toBe(true);
    expect(canProject(5000, 10000)).toBe(true);
    expect(canProject(10000, 21097)).toBe(true);
    expect(canProject(21097, 42195)).toBe(true);
  });

  it("refuses to extrapolate a marathon from a short run", () => {
    expect(canProject(2000, 42195)).toBe(false);
    expect(canProject(5000, 42195)).toBe(false);
  });

  it("refuses to infer a short PR from a very long run", () => {
    expect(canProject(42195, 5000)).toBe(false);
  });
});

describe("formatPace", () => {
  it("formats seconds per km", () => {
    expect(formatPace(302)).toBe("5:02/km");
    expect(formatPace(360)).toBe("6:00/km");
  });
});
