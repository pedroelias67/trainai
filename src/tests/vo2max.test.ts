import { describe, it, expect } from "vitest";
import {
  vdot,
  estimateVO2max,
  effortsFromActivities,
  vo2maxRating,
  type EffortRecord,
} from "@/lib/vo2max";

const NOW = new Date(2026, 7, 23); // 23 Aug 2026
const mmss = (m: number, s: number) => m * 60 + s;

describe("vdot", () => {
  // Checked against the published VDOT tables in Daniels' Running Formula.
  it.each([
    ["5K 30:40", 5000, mmss(30, 40), 30],
    ["5K 24:08", 5000, mmss(24, 8), 40],
    ["5K 19:57", 5000, mmss(19, 57), 50],
    ["5K 17:03", 5000, mmss(17, 3), 60],
    ["5K 14:52", 5000, mmss(14, 52), 70],
    ["10K 41:21", 10000, mmss(41, 21), 50],
    ["10K 35:22", 10000, mmss(35, 22), 60],
  ])("matches the table for %s", (_label, metres, seconds, expected) => {
    expect(vdot(metres, seconds)).toBeCloseTo(expected, 0);
  });

  it("rises as the same distance is run faster", () => {
    expect(vdot(5000, mmss(20, 0))!).toBeGreaterThan(vdot(5000, mmss(22, 0))!);
  });

  it("rejects nonsense input", () => {
    expect(vdot(0, 1200)).toBeNull();
    expect(vdot(5000, 0)).toBeNull();
    expect(vdot(-5000, 1200)).toBeNull();
  });
});

describe("estimateVO2max", () => {
  const rec = (distance: number, timeSeconds: number, date: string): EffortRecord =>
    ({ distance, timeSeconds, date: new Date(date) });

  it("estimates from a recent effort", () => {
    const out = estimateVO2max([rec(5000, mmss(19, 57), "2026-08-01")], NOW);
    expect(out!.value).toBeCloseTo(50, 0);
    expect(out!.confidence).toBe("alta");
  });

  it("picks the effort giving the highest VDOT, not the longest", () => {
    const out = estimateVO2max([
      rec(5000, mmss(24, 8), "2026-08-01"),  // VDOT 40
      rec(10000, mmss(41, 21), "2026-08-02"), // VDOT 50
    ], NOW);
    expect(out!.value).toBeCloseTo(50, 0);
    expect(out!.source).toContain("10 km");
  });

  it("is not dragged down by easy runs in the same window", () => {
    const out = estimateVO2max([
      rec(5000, mmss(19, 57), "2026-08-01"), // hard
      rec(10000, mmss(70, 0), "2026-08-03"), // easy
      rec(8000, mmss(56, 0), "2026-08-05"),  // easy
    ], NOW);
    expect(out!.value).toBeCloseTo(50, 0);
  });

  it("ignores efforts outside the formula's valid range", () => {
    // A 90-second sprint and a 4-hour marathon both fall outside it.
    expect(estimateVO2max([
      rec(400, 90, "2026-08-01"),
      rec(42195, 4 * 3600, "2026-08-02"),
    ], NOW)).toBeNull();
  });

  it("ignores efforts older than the window", () => {
    expect(estimateVO2max([rec(5000, mmss(19, 57), "2023-01-01")], NOW)).toBeNull();
  });

  it("lowers confidence for an older performance", () => {
    expect(estimateVO2max([rec(5000, mmss(19, 57), "2026-01-15")], NOW)!.confidence).toBe("média");
  });

  it("returns nothing rather than a fabricated number", () => {
    expect(estimateVO2max([], NOW)).toBeNull();
  });
});

describe("effortsFromActivities", () => {
  it("keeps running activities that have both distance and duration", () => {
    const out = effortsFromActivities([
      { date: "2026-08-01", sport: "RUNNING", distance: 5000, duration: 1197 },
      { date: "2026-08-02", sport: "CYCLING", distance: 40000, duration: 3600 },
      { date: "2026-08-03", sport: "RUNNING", distance: null, duration: 1800 },
      { date: "2026-08-04", sport: "RUNNING", distance: 5000, duration: null },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ distance: 5000, timeSeconds: 1197 });
  });

  it("feeds the estimate straight from activity history", () => {
    const efforts = effortsFromActivities([
      { date: "2026-08-01", sport: "RUNNING", distance: 10000, duration: mmss(41, 21) },
    ]);
    expect(estimateVO2max(efforts, NOW)!.value).toBeCloseTo(50, 0);
  });
});

describe("vo2maxRating", () => {
  it("places a value within its age and sex band", () => {
    expect(vo2maxRating(58, 35, "MALE")).toBe("Superior");
    expect(vo2maxRating(45, 35, "MALE")).toBe("Bom");
    expect(vo2maxRating(30, 35, "MALE")).toBe("A construir");
    expect(vo2maxRating(46, 35, "FEMALE")).toBe("Superior");
  });

  it("declines to rate without age or sex rather than assuming them", () => {
    expect(vo2maxRating(50, null, "MALE")).toBeNull();
    expect(vo2maxRating(50, 35, null)).toBeNull();
  });

  it("clamps ages beyond the published bands", () => {
    expect(vo2maxRating(50, 75, "MALE")).toBe("Superior");
    expect(vo2maxRating(60, 16, "MALE")).toBe("Superior");
  });
});
