import { describe, it, expect } from "vitest";
import { capLongRun, LONG_RUN_CAP_KM, raceGuidance } from "@/lib/race-distances";

describe("capLongRun", () => {
  it("brings an over-long run back to the cap for the race", () => {
    // The plan that prompted this: an 18 km long run inside a 10K plan.
    const out = capLongRun(
      { sessionType: "LONG", plannedDistanceKm: 18, plannedDurationMin: 126 },
      "TEN_K"
    );
    expect(out.plannedDistanceKm).toBe(16);
    expect(out.plannedDurationMin).toBe(112); // shortened in step, so the pace holds
  });

  it("leaves a sensible session exactly as written", () => {
    const session = { sessionType: "LONG", plannedDistanceKm: 14, plannedDurationMin: 98 };
    expect(capLongRun(session, "TEN_K")).toEqual(session);
  });

  it("never shortens the race itself", () => {
    const race = { sessionType: "RACE", plannedDistanceKm: 42.2, plannedDurationMin: 240 };
    expect(capLongRun(race, "MARATHON")).toEqual(race);
  });

  it("scales the cap to the race", () => {
    expect(capLongRun({ sessionType: "LONG", plannedDistanceKm: 30 }, "FIVE_K").plannedDistanceKm).toBe(12);
    expect(capLongRun({ sessionType: "LONG", plannedDistanceKm: 30 }, "MARATHON").plannedDistanceKm).toBe(30);
    expect(LONG_RUN_CAP_KM.HALF_MARATHON).toBeGreaterThan(LONG_RUN_CAP_KM.TEN_K);
  });

  it("passes through what it cannot judge", () => {
    const noDistance = { sessionType: "EASY", plannedDurationMin: 45 };
    expect(capLongRun(noDistance, "TEN_K")).toEqual(noDistance);
    const unknownRace = { sessionType: "LONG", plannedDistanceKm: 99 };
    expect(capLongRun(unknownRace, "QUALQUER_COISA")).toEqual(unknownRace);
  });
});

describe("raceGuidance", () => {
  it("states the distance and the ceiling in the prompt", () => {
    const text = raceGuidance("TEN_K");
    expect(text).toContain("10 km");
    expect(text).toContain("16 km");
  });

  it("says nothing about a race it does not know", () => {
    expect(raceGuidance("QUALQUER_COISA")).toBe("");
  });
});
