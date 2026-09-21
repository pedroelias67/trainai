import { describe, it, expect } from "vitest";
import { rescheduleWeek, type Placement, type SessionToPlace } from "@/lib/reschedule";

const week: SessionToPlace[] = [
  { id: "seg", sessionType: "EASY", dayOfWeek: 1 },
  { id: "ter", sessionType: "INTERVALS", dayOfWeek: 2 },
  { id: "qui", sessionType: "TEMPO", dayOfWeek: 4 },
  { id: "sab", sessionType: "RECOVERY", dayOfWeek: 6 },
  { id: "dom", sessionType: "LONG", dayOfWeek: 7 },
];

const dayOf = (out: Placement[], id: string) => {
  const p = out.find(x => x.id === id);
  return p && "dayOfWeek" in p ? p.dayOfWeek : null;
};

describe("rescheduleWeek", () => {
  it("keeps every session, on the new days only", () => {
    const out = rescheduleWeek(week, [2, 3, 5, 6, 7], 7);
    const days = out.map(p => ("dayOfWeek" in p ? p.dayOfWeek : null));

    expect(out).toHaveLength(5);
    expect(days.every(d => d !== null && [2, 3, 5, 6, 7].includes(d))).toBe(true);
    expect(new Set(days).size).toBe(5); // one session per day
  });

  it("puts the long run on the long-run day", () => {
    expect(dayOf(rescheduleWeek(week, [1, 3, 5, 6, 7], 6), "dom")).toBe(6);
  });

  it("falls back to the last available day when the long-run day is not one", () => {
    expect(dayOf(rescheduleWeek(week, [1, 2, 3, 4, 5], 7), "dom")).toBe(5);
  });

  it("never puts two hard sessions on consecutive days", () => {
    const out = rescheduleWeek(week, [1, 2, 4, 6, 7], 7);
    const hard = [dayOf(out, "ter"), dayOf(out, "qui")].sort((a, b) => a! - b!);
    expect(hard[1]! - hard[0]!).toBeGreaterThan(1);
  });

  it("keeps a hard session off the eve of the long run", () => {
    const out = rescheduleWeek(
      [
        { id: "longo", sessionType: "LONG", dayOfWeek: 7 },
        { id: "duro", sessionType: "INTERVALS", dayOfWeek: 3 },
        { id: "facil", sessionType: "EASY", dayOfWeek: 1 },
      ],
      [1, 3, 6, 7], 7
    );
    expect(dayOf(out, "duro")).not.toBe(6);
  });

  it("drops the least important sessions when the week loses days", () => {
    // Five sessions, three days: the recovery run and one easy go.
    const out = rescheduleWeek(week, [2, 4, 7], 7);
    const placed = out.filter(p => "dayOfWeek" in p).map(p => p.id);

    expect(placed).toHaveLength(3);
    expect(placed).toContain("dom");  // long run
    expect(placed).toContain("ter");  // intervals
    expect(placed).not.toContain("sab"); // recovery is the first to go
  });

  it("only uses days still ahead in a week already under way", () => {
    const out = rescheduleWeek(week, [1, 2, 4, 6, 7], 7, 5);
    const days = out.filter((p): p is { id: string; dayOfWeek: number } => "dayOfWeek" in p).map(p => p.dayOfWeek);
    expect(days.every(d => d >= 5)).toBe(true);
    expect(days).toHaveLength(2); // only Saturday and Sunday are left
  });

  it("drops everything rather than inventing days when none are available", () => {
    expect(rescheduleWeek(week, [1, 2], 7, 5).every(p => "dropped" in p)).toBe(true);
  });

  it("changes nothing when the days have not changed", () => {
    // The first version reshuffled the whole week even when asked for the same
    // days: Monday's easy run came out on Wednesday.
    const out = rescheduleWeek(week, [1, 2, 4, 6, 7], 7);
    for (const s of week) expect(dayOf(out, s.id)).toBe(s.dayOfWeek);
  });

  it("does not repair a plan that already broke the rules", () => {
    // This plan has its tempo run the day before the long run. Answering "I
    // train on these days" is not the moment to move sessions nobody asked about.
    const eve: SessionToPlace[] = [
      { id: "tempo", sessionType: "TEMPO", dayOfWeek: 6 },
      { id: "longo", sessionType: "LONG", dayOfWeek: 7 },
    ];
    const out = rescheduleWeek(eve, [1, 6, 7], 7);
    expect(dayOf(out, "tempo")).toBe(6);
  });

  it("moves one session when one day changes", () => {
    // Saturday becomes Friday: only the Saturday session should move.
    const out = rescheduleWeek(week, [1, 2, 4, 5, 7], 7);
    expect(dayOf(out, "sab")).toBe(5);
    for (const s of week.filter(x => x.id !== "sab")) expect(dayOf(out, s.id)).toBe(s.dayOfWeek);
  });

  it("keeps the plan's own order among the easy sessions", () => {
    const out = rescheduleWeek(
      [
        { id: "primeiro", sessionType: "EASY", dayOfWeek: 1 },
        { id: "segundo", sessionType: "EASY", dayOfWeek: 3 },
        { id: "terceiro", sessionType: "EASY", dayOfWeek: 5 },
      ],
      [2, 4, 6], 7
    );
    expect(dayOf(out, "primeiro")).toBe(2);
    expect(dayOf(out, "segundo")).toBe(4);
    expect(dayOf(out, "terceiro")).toBe(6);
  });
});
