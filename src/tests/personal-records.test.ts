import { describe, it, expect } from "vitest";
import { matchesDistance, formatPace } from "@/lib/personal-records";

describe("matchesDistance", () => {
  it("accepts an activity that really covers the distance", () => {
    expect(matchesDistance(5000, 5000)).toBe(true);
    expect(matchesDistance(5120, 5000)).toBe(true);   // race run slightly long
    expect(matchesDistance(4960, 5000)).toBe(true);   // GPS undershoot
    expect(matchesDistance(21300, 21097)).toBe(true);
  });

  it("never credits a distance the athlete did not run", () => {
    // The bug this guards: a 10K producing a half-marathon "record".
    expect(matchesDistance(10000, 21097)).toBe(false);
    expect(matchesDistance(17000, 21097)).toBe(false);
    expect(matchesDistance(21097, 42195)).toBe(false);
  });

  it("does not credit a short distance from a much longer run", () => {
    // The 5K split inside a marathon is not the marathon's total time.
    expect(matchesDistance(42195, 5000)).toBe(false);
    expect(matchesDistance(10000, 5000)).toBe(false);
  });

  it("rejects an activity meaningfully short of the distance", () => {
    expect(matchesDistance(4800, 5000)).toBe(false);
    expect(matchesDistance(20000, 21097)).toBe(false);
  });
});

describe("formatPace", () => {
  it("formats seconds per km", () => {
    expect(formatPace(302)).toBe("5:02/km");
    expect(formatPace(360)).toBe("6:00/km");
  });
});
