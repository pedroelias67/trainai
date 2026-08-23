import { describe, it, expect } from "vitest";
import { monthlyStats, formatPace, formatHours, type StatActivity } from "@/lib/monthly-stats";

const NOW = new Date(2026, 7, 23); // 23 Aug 2026

const run = (date: string, km: number, mins: number, ele = 0): StatActivity => ({
  date: new Date(date), sport: "RUNNING",
  distance: km * 1000, duration: mins * 60, elevationGain: ele,
});

describe("monthlyStats", () => {
  it("keeps empty months in the series so gaps are visible", () => {
    const out = monthlyStats([run("2026-08-10", 10, 50)], 6, NOW);
    expect(out).toHaveLength(6);
    expect(out.map(m => m.key)).toEqual([
      "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08",
    ]);
    expect(out.slice(0, 5).every(m => m.activities === 0)).toBe(true);
  });

  it("totals distance, time, elevation and count per month", () => {
    const out = monthlyStats([
      run("2026-08-02", 10, 50, 100),
      run("2026-08-20", 5.5, 30, 50),
      run("2026-07-15", 8, 40, 20),
    ], 2, NOW);

    expect(out[1]).toMatchObject({ key: "2026-08", activities: 2, km: 15.5, seconds: 4800, elevation: 150 });
    expect(out[0]).toMatchObject({ key: "2026-07", activities: 1, km: 8, elevation: 20 });
  });

  it("derives pace from monthly totals, not an average of averages", () => {
    // 10km in 50min (5:00/km) and 10km in 60min (6:00/km) → 20km in 110min = 5:30/km
    const out = monthlyStats([run("2026-08-02", 10, 50), run("2026-08-03", 10, 60)], 1, NOW);
    expect(out[0].paceSecPerKm).toBe(330);
    expect(formatPace(out[0].paceSecPerKm)).toBe("5:30/km");
  });

  it("keeps cycling out of the running pace but inside the distance total", () => {
    const out = monthlyStats([
      run("2026-08-02", 10, 50),
      { date: new Date("2026-08-04"), sport: "CYCLING", distance: 40000, duration: 3600, elevationGain: 0 },
    ], 1, NOW);

    expect(out[0].km).toBe(50);
    expect(formatPace(out[0].paceSecPerKm)).toBe("5:00/km");
    expect(out[0].kmBySport).toEqual({ RUNNING: 10, CYCLING: 40 });
  });

  it("computes the change against the previous month", () => {
    const out = monthlyStats([run("2026-07-10", 100, 500), run("2026-08-10", 150, 750)], 2, NOW);
    expect(out[1].kmChangePct).toBe(50);
  });

  it("leaves the change unset when the previous month had nothing", () => {
    const out = monthlyStats([run("2026-08-10", 50, 250)], 2, NOW);
    expect(out[1].kmChangePct).toBeNull();
    expect(out[0].kmChangePct).toBeNull();
  });

  it("ignores activities outside the window", () => {
    const out = monthlyStats([run("2025-01-10", 999, 9999)], 3, NOW);
    expect(out.every(m => m.activities === 0)).toBe(true);
  });

  it("survives activities with missing distance or duration", () => {
    const out = monthlyStats([
      { date: new Date("2026-08-05"), sport: "RUNNING", distance: null, duration: null, elevationGain: null },
    ], 1, NOW);
    expect(out[0]).toMatchObject({ activities: 1, km: 0, seconds: 0, elevation: 0, paceSecPerKm: null });
  });
});

describe("formatters", () => {
  it("formats pace and hours readably", () => {
    expect(formatPace(302)).toBe("5:02/km");
    expect(formatPace(null)).toBeNull();
    expect(formatHours(3600)).toBe("1h");
    expect(formatHours(5400)).toBe("1h30");
    expect(formatHours(1800)).toBe("30min");
  });
});
