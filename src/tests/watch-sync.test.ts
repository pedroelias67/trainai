import { describe, it, expect, vi, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  athlete: { findUnique: vi.fn(), update: vi.fn() },
  trainingWeek: { findFirst: vi.fn() },
  trainingSession: { findMany: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

const icu = vi.hoisted(() => ({ replaceEvents: vi.fn() }));
vi.mock("@/lib/intervals-icu", async () => {
  const actual = await vi.importActual<typeof import("@/lib/intervals-icu")>("@/lib/intervals-icu");
  return { ...actual, replaceEvents: icu.replaceEvents };
});

const record = vi.hoisted(() => ({
  recordIntervalsPush: vi.fn(),
  recordWeekOnCalendar: vi.fn(),
  checkWeekOnCalendar: vi.fn(async () => true),
}));
vi.mock("@/lib/intervals-connection", () => record);

import { sendWeekToWatch } from "@/lib/watch-sync";

const connected = {
  id: "a1", intervalsIcuApiKey: "key", intervalsIcuAthleteId: "i1", ltPace: "5:00/km",
};

const week = (over: Record<string, unknown> = {}) => ({
  endDate: new Date(Date.now() + 3 * 864e5),
  planId: "p1",
  sessions: [{
    id: "s1", name: "Intervalos", sport: "RUNNING", sessionType: "INTERVALS",
    date: new Date(), plannedDuration: 50, plannedPace: "5:00/km",
    warmup: "15min Z2", mainSet: "5x3min Z5 com 2min de recuperação", cooldown: "10min", steps: null,
  }],
  ...over,
});

describe("sendWeekToWatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.athlete.findUnique.mockResolvedValue(connected);
    db.trainingWeek.findFirst.mockResolvedValue(week());
    db.trainingSession.findMany.mockResolvedValue([]);
    icu.replaceEvents.mockResolvedValue({ ok: true, count: 1 });
  });

  it("sends the week and records that it went", async () => {
    const out = await sendWeekToWatch("a1", "w1");
    expect(out).toMatchObject({ status: "sent", count: 1, hasRunning: true });
    expect(record.recordIntervalsPush).toHaveBeenCalledWith("a1", null);
    expect(record.recordWeekOnCalendar).toHaveBeenCalled();
  });

  it("does nothing for an athlete who never connected a watch", async () => {
    db.athlete.findUnique.mockResolvedValue({ ...connected, intervalsIcuApiKey: null });
    expect(await sendWeekToWatch("a1", "w1")).toEqual({ status: "skipped", reason: "not-connected" });
    expect(icu.replaceEvents).not.toHaveBeenCalled();
  });

  it("leaves a week that is already over alone", async () => {
    // Rewriting it would only disturb training the athlete has done.
    db.trainingWeek.findFirst.mockResolvedValue(week({ endDate: new Date(Date.now() - 864e5) }));
    expect(await sendWeekToWatch("a1", "w1")).toEqual({ status: "skipped", reason: "past-week" });
    expect(icu.replaceEvents).not.toHaveBeenCalled();
  });

  it("has nothing to send for an empty or unknown week", async () => {
    db.trainingWeek.findFirst.mockResolvedValue(week({ sessions: [] }));
    expect(await sendWeekToWatch("a1", "w1")).toMatchObject({ reason: "no-sessions" });

    db.trainingWeek.findFirst.mockResolvedValue(null);
    expect(await sendWeekToWatch("a1", "w1")).toMatchObject({ reason: "no-sessions" });
  });

  it("records a refusal from Intervals.icu instead of raising it", async () => {
    // The caller is saving an edit or finishing a plan; that must not fail here.
    icu.replaceEvents.mockResolvedValue({ ok: false, error: "Intervals.icu respondeu 401" });
    expect(await sendWeekToWatch("a1", "w1")).toMatchObject({ status: "failed" });
    expect(record.recordIntervalsPush).toHaveBeenCalledWith("a1", "Intervals.icu respondeu 401");
  });

  it("swallows an unexpected failure, and writes it down", async () => {
    icu.replaceEvents.mockRejectedValue(new Error("rede em baixo"));
    expect(await sendWeekToWatch("a1", "w1")).toEqual({ status: "failed", error: "rede em baixo" });
    expect(record.recordIntervalsPush).toHaveBeenCalledWith("a1", "rede em baixo");
  });

  it("reads the reference pace from the whole plan, not one week", async () => {
    // A recovery week on its own implies a slower threshold, and the same zone
    // would mean one pace this week and another the next.
    db.trainingSession.findMany.mockResolvedValue([
      { sport: "RUNNING", sessionType: "TEMPO", plannedPace: "5:02/km" },
      { sport: "RUNNING", sessionType: "EASY", plannedPace: "6:20/km" },
      { sport: "RUNNING", sessionType: "LONG", plannedPace: "6:00/km" },
    ]);
    db.trainingWeek.findFirst.mockResolvedValue(week({
      sessions: [{
        id: "s1", name: "Recuperação", sport: "RUNNING", sessionType: "RECOVERY",
        date: new Date(), plannedDuration: 30, plannedPace: "7:30/km",
        warmup: null, mainSet: "30min muito leve", cooldown: null, steps: null,
      }],
    }));

    const out = await sendWeekToWatch("a1", "w1");
    // From the plan: around 5:00/km. From the recovery week alone: near 5:27.
    expect(out.status === "sent" && Math.round(out.thresholdSecPerKm!)).toBeLessThan(315);
  });

  it("falls back to the week when the plan has no running sessions to read", async () => {
    db.trainingSession.findMany.mockResolvedValue([]);
    const out = await sendWeekToWatch("a1", "w1");
    expect(out.status === "sent" && out.thresholdSecPerKm).toBeTruthy();
  });

  it("converts the week's zones to pace before sending", async () => {
    await sendWeekToWatch("a1", "w1");
    const [, , events] = icu.replaceEvents.mock.calls[0];
    expect(events[0].description).toContain("/km Pace");
    expect(events[0].description).not.toContain("HR");
  });
});
