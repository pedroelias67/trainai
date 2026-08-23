import { describe, it, expect } from "vitest";
import { riegel, pickReferenceRecord, formatRaceDistance } from "@/lib/race-prediction";

const HALF = 21097;
const FIVE_K = 5000;

describe("riegel", () => {
  it("returns the known time for the known distance", () => {
    expect(riegel(1500, FIVE_K, FIVE_K)).toBeCloseTo(1500, 5);
  });

  it("projects a 25:00 5K to a plausible half marathon", () => {
    const secs = riegel(25 * 60, FIVE_K, HALF);
    // Around 1h55 — the point is that it lands in the right order of magnitude.
    expect(secs).toBeGreaterThan(105 * 60);
    expect(secs).toBeLessThan(125 * 60);
  });

  it("guards against the unit slip that produced 5-second half marathons", () => {
    // Passing kilometres where metres are expected used to yield sub-second times.
    const correct = riegel(25 * 60, FIVE_K, HALF);
    expect(correct).toBeGreaterThan(60);
  });

  it("returns zero rather than NaN on empty input", () => {
    expect(riegel(0, FIVE_K, HALF)).toBe(0);
    expect(riegel(1500, 0, HALF)).toBe(0);
  });
});

describe("pickReferenceRecord", () => {
  const records = [
    { distance: 5000, timeSeconds: 1500 },
    { distance: 10000, timeSeconds: 3150 },
  ];

  it("picks the record nearest the target", () => {
    expect(pickReferenceRecord(records, HALF)!.distance).toBe(10000);
    expect(pickReferenceRecord(records, 5000)!.distance).toBe(5000);
  });

  it("skips records with no usable time or distance", () => {
    const out = pickReferenceRecord([{ distance: 5000, timeSeconds: 0 }, ...records], 5000);
    expect(out!.timeSeconds).toBe(1500);
  });

  it("returns null when there is nothing to work from", () => {
    expect(pickReferenceRecord([], HALF)).toBeNull();
  });
});

describe("formatRaceDistance", () => {
  it("reads as a distance, not a raw metre count", () => {
    expect(formatRaceDistance(5000)).toBe("5 km");
    expect(formatRaceDistance(10000)).toBe("10 km");
    expect(formatRaceDistance(21097)).toBe("21,1 km");
  });
});
