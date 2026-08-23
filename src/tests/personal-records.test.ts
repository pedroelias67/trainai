import { describe, it, expect } from "vitest";
import {
  matchesDistance,
  formatPace,
  paceToSeconds,
  bestEffortFromSplits,
} from "@/lib/personal-records";

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

describe("paceToSeconds", () => {
  it("parses the stored pace format", () => {
    expect(paceToSeconds("5:25/km")).toBe(325);
    expect(paceToSeconds("6:00/km")).toBe(360);
  });

  it("rejects what it cannot parse", () => {
    expect(paceToSeconds("N/A")).toBeNull();
    expect(paceToSeconds(null)).toBeNull();
  });
});

describe("bestEffortFromSplits", () => {
  const splits = (paces: string[]) => paces.map((pace, i) => ({ km: i + 1, pace }));

  it("finds the fastest continuous stretch inside a longer run", () => {
    // km 3-7 are the quick ones: 300+300+300+310+310 = 1520s
    const out = bestEffortFromSplits(
      splits(["360", "360", "300", "300", "300", "310", "310", "360"].map(s => `${Math.floor(+s / 60)}:${String(+s % 60).padStart(2, "0")}/km`)),
      8000,
      5
    );
    expect(out).toBe(1520);
  });

  it("ignores the trailing partial kilometre", () => {
    // 7.7km run: the 8th split covers 700m but its pace reads per-km, so using
    // it as a full kilometre would invent 300m of running.
    const paces = ["5:00/km", "5:00/km", "5:00/km", "5:00/km", "5:00/km", "5:00/km", "5:00/km", "3:00/km"];
    expect(bestEffortFromSplits(splits(paces), 7700, 5)).toBe(1500);
  });

  it("returns null when the run is shorter than the target", () => {
    expect(bestEffortFromSplits(splits(["5:00/km", "5:00/km"]), 2000, 5)).toBeNull();
  });

  it("returns null when a split cannot be read", () => {
    const paces = ["5:00/km", "N/A", "5:00/km", "5:00/km", "5:00/km", "5:00/km"];
    expect(bestEffortFromSplits(splits(paces), 6000, 5)).toBeNull();
  });
});
