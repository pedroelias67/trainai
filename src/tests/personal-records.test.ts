import { describe, it, expect } from "vitest";
import {
  matchesDistance,
  formatPace,
  bestEffortSeconds,
  bestTimeForDistance,
  type RunForRecords,
} from "@/lib/personal-records";
import { clockParts, formatClock, formatPacePerKm } from "@/lib/format";

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

describe("bestEffortSeconds", () => {
  const efforts = [
    { name: "5K", elapsed_time: 1631, moving_time: 1620 },
    { name: "Half-Marathon", elapsed_time: 7475 },
  ];

  it("reads the elapsed time of the named effort", () => {
    expect(bestEffortSeconds(efforts, "5K")).toBe(1631);
    expect(bestEffortSeconds(efforts, "Half-Marathon")).toBe(7475);
  });

  it("has nothing for an effort the run did not include, or no efforts at all", () => {
    expect(bestEffortSeconds(efforts, "Marathon")).toBeNull();
    expect(bestEffortSeconds(null, "5K")).toBeNull();
    expect(bestEffortSeconds({ name: "5K" }, "5K")).toBeNull();
  });
});

describe("bestTimeForDistance", () => {
  const FIVE_K = { meters: 5000, stravaEffort: "5K" };
  const HALF = { meters: 21097, stravaEffort: "Half-Marathon" };

  const run = (over: Partial<RunForRecords>): RunForRecords => ({
    id: "r", date: new Date("2026-09-13"), distance: 10000, duration: 3000,
    elapsedTime: null, bestEfforts: null, ...over,
  });

  it("ignores a stretch that was only fast because the stops were left out", () => {
    // The athlete's run of 18 August: 7.72 km, 43:04 moving but 53:07 elapsed.
    // Summing moving-time splits made a 27:07 5K of it; Strava, counting the
    // stops, measured the best 5K inside it at 37:01.
    const aug18 = run({
      id: "aug18", distance: 7720, duration: 2584, elapsedTime: 3187,
      bestEfforts: [{ name: "5K", elapsed_time: 2221 }],
    });
    const aug20 = run({
      id: "aug20", distance: 10090, duration: 3437, elapsedTime: 3440,
      bestEfforts: [{ name: "5K", elapsed_time: 1631 }, { name: "10K", elapsed_time: 3405 }],
    });
    expect(bestTimeForDistance([aug18, aug20], FIVE_K)).toMatchObject({ activityId: "aug20", timeSeconds: 1631 });
  });

  it("credits the half marathon run on 13 September", () => {
    const race = run({
      id: "porto", distance: 21410.8, duration: 7588, elapsedTime: 7596,
      bestEfforts: [{ name: "5K", elapsed_time: 1714 }, { name: "Half-Marathon", elapsed_time: 7475 }],
    });
    expect(bestTimeForDistance([race], HALF)).toMatchObject({ activityId: "porto", timeSeconds: 7475 });
  });

  it("falls back to the whole run, by elapsed time, when there are no best efforts", () => {
    const manual = run({ distance: 21150, duration: 7400, elapsedTime: 7460 });
    expect(bestTimeForDistance([manual], HALF)?.timeSeconds).toBe(7460);
  });

  it("falls back to the whole run when the GPS measured the race just short", () => {
    // Strava only records an effort the track is long enough for.
    const short = run({
      distance: 21050, duration: 7500, elapsedTime: 7510,
      bestEfforts: [{ name: "5K", elapsed_time: 1700 }],
    });
    expect(bestTimeForDistance([short], HALF)?.timeSeconds).toBe(7510);
  });

  it("never credits a distance the athlete did not run", () => {
    const tenK = run({ distance: 10000, bestEfforts: [{ name: "5K", elapsed_time: 1500 }] });
    expect(bestTimeForDistance([tenK], HALF)).toBeNull();
  });

  it("skips GPS glitches", () => {
    const glitch = run({ distance: 21100, duration: 600, bestEfforts: [{ name: "Half-Marathon", elapsed_time: 600 }] });
    expect(bestTimeForDistance([glitch], HALF)).toBeNull();
  });
});

describe("time and pace formatting", () => {
  it("never shows 60 seconds", () => {
    // The half marathon's km 21 split read "5:60/km", and its record
    // would have too: 7588 s over 21.097 km is 359.7 s/km.
    expect(formatPacePerKm(359.7)).toBe("6:00/km");
    expect(formatPace(359.7)).toBe("6:00/km");
    expect(formatClock(3599.6)).toBe("1:00:00");
    expect(clockParts(119.5)).toEqual({ h: 0, m: 2, s: 0 });
  });

  it("formats the ordinary cases", () => {
    expect(formatPacePerKm(302)).toBe("5:02/km");
    expect(formatClock(1631)).toBe("27:11");
    expect(formatClock(7475)).toBe("2:04:35");
  });
});
