import { describe, it, expect } from "vitest";
import {
  planStartFrom, sessionDateFor, startsNextWeek, todayDayOfWeek,
  utcMidnight, weekEndFor, weekStartFor,
} from "@/lib/plan-calendar";

// These assertions are exact ISO strings on purpose. They are what tells us the
// grid does not move when the machine running it is not on UTC — which is how
// a plan once came out with every week starting at 23:00 on the Sunday.
describe("planStartFrom", () => {
  it("anchors to the Monday of the week under way", () => {
    // Uma quarta-feira, às 11h de Lisboa.
    expect(planStartFrom(new Date("2026-09-30T10:04:00Z")).toISOString())
      .toBe("2026-09-28T00:00:00.000Z");
  });

  it("keeps a Monday where it is", () => {
    expect(planStartFrom(new Date("2026-09-28T10:16:00Z")).toISOString())
      .toBe("2026-09-28T00:00:00.000Z");
  });

  it("rolls a Sunday forward to tomorrow", () => {
    // Uma primeira semana de um dia não serve de nada.
    expect(planStartFrom(new Date("2026-09-27T20:44:00Z")).toISOString())
      .toBe("2026-09-28T00:00:00.000Z");
    expect(startsNextWeek(new Date("2026-09-27T20:44:00Z"))).toBe(true);
    expect(startsNextWeek(new Date("2026-09-28T00:30:00Z"))).toBe(false);
  });

  it("does not drift just before or after midnight UTC", () => {
    // Um minuto antes da meia-noite de segunda ainda é domingo.
    expect(planStartFrom(new Date("2026-09-27T23:59:59Z")).toISOString())
      .toBe("2026-09-28T00:00:00.000Z");
    expect(planStartFrom(new Date("2026-09-28T00:00:00Z")).toISOString())
      .toBe("2026-09-28T00:00:00.000Z");
  });
});

describe("todayDayOfWeek", () => {
  it("counts Monday as 1 and Sunday as 7, like a session does", () => {
    expect(todayDayOfWeek(new Date("2026-09-28T10:00:00Z"))).toBe(1);
    expect(todayDayOfWeek(new Date("2026-10-03T10:00:00Z"))).toBe(6);
    expect(todayDayOfWeek(new Date("2026-10-04T10:00:00Z"))).toBe(7);
  });
});

describe("weeks and sessions", () => {
  const planStart = new Date("2026-09-28T00:00:00Z");

  it("puts each week seven days after the last", () => {
    expect(weekStartFor(planStart, 1).toISOString()).toBe("2026-09-28T00:00:00.000Z");
    expect(weekStartFor(planStart, 2).toISOString()).toBe("2026-10-05T00:00:00.000Z");
    expect(weekStartFor(planStart, 4).toISOString()).toBe("2026-10-19T00:00:00.000Z");
  });

  it("ends a week at the last instant of its Sunday", () => {
    expect(weekEndFor(weekStartFor(planStart, 1)).toISOString())
      .toBe("2026-10-04T23:59:59.999Z");
  });

  it("places a session on its day", () => {
    const semana = weekStartFor(planStart, 1);
    expect(sessionDateFor(semana, 1).toISOString()).toBe("2026-09-28T00:00:00.000Z");
    expect(sessionDateFor(semana, 7).toISOString()).toBe("2026-10-04T00:00:00.000Z");
  });

  it("does not shift across the end of summer time", () => {
    // O horário de verão acaba em Portugal no domingo 25 de outubro de 2026.
    // Aritmética local faria essa semana ter 169 horas e a prova cairia no
    // sábado; em UTC os dias continuam a ter o mesmo tamanho.
    const outubro = new Date("2026-10-19T00:00:00Z");
    expect(sessionDateFor(outubro, 7).toISOString()).toBe("2026-10-25T00:00:00.000Z");
    expect(weekEndFor(outubro).toISOString()).toBe("2026-10-25T23:59:59.999Z");
  });
});

describe("utcMidnight", () => {
  it("keeps the calendar day and drops the time", () => {
    expect(utcMidnight(new Date("2026-09-28T22:45:13.123Z")).toISOString())
      .toBe("2026-09-28T00:00:00.000Z");
  });
});
