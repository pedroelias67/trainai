import { describe, it, expect } from "vitest";
import { recentTrainingGuidance, summariseRecentTraining, type PastActivity } from "@/lib/recent-training";

const now = new Date("2026-09-21T12:00:00Z");
const run = (daysAgo: number, km: number, sport = "RUNNING"): PastActivity => ({
  date: new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000),
  distance: km * 1000,
  sport,
});

describe("summariseRecentTraining", () => {
  it("reports the weekly habit behind the runs", () => {
    // 8 runs over four weeks, 80 km, longest 15.
    const runs = [
      run(1, 10), run(3, 8), run(6, 15), run(9, 10),
      run(12, 8), run(16, 12), run(20, 9), run(25, 8),
    ];
    expect(summariseRecentTraining(runs, now)).toEqual({
      weeks: 4, avgKmPerWeek: 20, peakKmPerWeek: 33, sessionsPerWeek: 2, longestRunKm: 15,
    });
  });

  it("ignores other sports and anything outside the window", () => {
    const mixed = [
      run(1, 10), run(3, 10), run(5, 10), run(7, 10),
      run(2, 60, "CYCLING"),
      run(40, 30), // before the window
    ];
    const out = summariseRecentTraining(mixed, now)!;
    expect(out.longestRunKm).toBe(10);
    expect(out.avgKmPerWeek).toBe(10);
  });

  it("reports the biggest week, not just the average", () => {
    // A taper before a race drags the average down and says nothing about form:
    // 40 km three weeks ago, then a quiet fortnight.
    const runs = [
      run(20, 20), run(18, 20), run(10, 5), run(8, 5), run(3, 6), run(1, 4),
    ];
    const out = summariseRecentTraining(runs, now)!;
    expect(out.peakKmPerWeek).toBe(40);
    expect(out.avgKmPerWeek).toBeLessThan(out.peakKmPerWeek);
  });

  it("says nothing when there is too little to go on", () => {
    expect(summariseRecentTraining([run(1, 10), run(3, 8), run(5, 6)], now)).toBeNull();
    expect(summariseRecentTraining([], now)).toBeNull();
  });
});

describe("recentTrainingGuidance", () => {
  it("tells the model to continue from where the athlete is", () => {
    const text = recentTrainingGuidance({ weeks: 4, avgKmPerWeek: 47, peakKmPerWeek: 58, sessionsPerWeek: 5, longestRunKm: 15 });
    expect(text).toContain("47 km");
    expect(text).toContain("58 km");
    expect(text).toContain("15 km");
    expect(text).toContain("10%");
  });

  it("stays quiet for an athlete with no history", () => {
    expect(recentTrainingGuidance(null)).toBe("");
  });
});
