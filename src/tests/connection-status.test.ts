import { describe, it, expect } from "vitest";
import { daysAgo, intervalsStatus, stravaStatus, worstLevel, type ConnectionFacts } from "@/lib/connection-status";

const now = new Date("2026-09-15T12:00:00Z");
const ago = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

const facts = (over: Partial<ConnectionFacts> = {}): ConnectionFacts => ({
  stravaConnected: true, stravaSyncError: null, stravaSyncErrorAt: null, lastActivityAt: ago(1),
  intervalsConnected: true, intervalsIcuLastPushAt: ago(2), intervalsIcuPushError: null,
  intervalsIcuHasRunThreshold: true, intervalsIcuWeekOnCalendar: null, hasActivePlan: true, ...over,
});

describe("stravaStatus", () => {
  it("is fine when activities keep arriving", () => {
    expect(stravaStatus(facts(), now)).toEqual({ level: "ok", label: "Última atividade ontem" });
  });

  it("flags a failing sync as broken, whatever the last activity", () => {
    const s = stravaStatus(facts({ stravaSyncError: "O Strava recusou o acesso", stravaSyncErrorAt: ago(3) }), now);
    expect(s).toMatchObject({ level: "error", label: "Falha a sincronizar" });
    expect(s.detail).toContain("há 3 dias");
  });

  it("tells a revoked link apart from one never made", () => {
    expect(stravaStatus(facts({ stravaConnected: false, stravaSyncError: "Acesso removido" }), now).level).toBe("error");
    expect(stravaStatus(facts({ stravaConnected: false }), now)).toMatchObject({ level: "warning", label: "Não ligado" });
  });

  it("notices a week of silence", () => {
    expect(stravaStatus(facts({ lastActivityAt: ago(8) }), now)).toMatchObject({ level: "warning", label: "Sem atividades há 8 dias" });
    expect(stravaStatus(facts({ lastActivityAt: ago(6) }), now).level).toBe("ok");
    expect(stravaStatus(facts({ lastActivityAt: null }), now).label).toBe("Ligado, sem atividades");
  });
});

describe("intervalsStatus", () => {
  it("is optional: not connected is not a problem", () => {
    expect(intervalsStatus(facts({ intervalsConnected: false }), now).level).toBe("off");
  });

  it("puts a failed send first", () => {
    expect(intervalsStatus(facts({ intervalsIcuPushError: "Chave recusada", intervalsIcuHasRunThreshold: false }), now))
      .toMatchObject({ level: "error", detail: "Chave recusada" });
  });

  it("flags the missing threshold pace, the fault that looks like everything working", () => {
    expect(intervalsStatus(facts({ intervalsIcuHasRunThreshold: false }), now))
      .toMatchObject({ level: "warning", label: "Falta o ritmo de limiar" });
  });

  it("trusts the calendar over any timestamp", () => {
    // A week sent before sends were recorded is still on the watch, and one sent
    // yesterday to a different week is not this week.
    expect(intervalsStatus(facts({ intervalsIcuWeekOnCalendar: true, intervalsIcuLastPushAt: null }), now))
      .toEqual({ level: "ok", label: "Semana atual no relógio" });
    expect(intervalsStatus(facts({ intervalsIcuWeekOnCalendar: false, intervalsIcuLastPushAt: ago(1) }), now))
      .toMatchObject({ level: "warning", label: "Semana atual por enviar" });
  });

  it("still reports a failed send or a missing threshold first", () => {
    expect(intervalsStatus(facts({ intervalsIcuWeekOnCalendar: true, intervalsIcuPushError: "Chave recusada" }), now).level).toBe("error");
    expect(intervalsStatus(facts({ intervalsIcuWeekOnCalendar: true, intervalsIcuHasRunThreshold: false }), now).label)
      .toBe("Falta o ritmo de limiar");
  });

  it("notices a plan whose weeks are not reaching the watch", () => {
    expect(intervalsStatus(facts({ intervalsIcuLastPushAt: null }), now).label).toBe("Nenhuma semana enviada");
    expect(intervalsStatus(facts({ intervalsIcuLastPushAt: ago(9) }), now).level).toBe("warning");
  });

  it("expects no sends from someone without a plan", () => {
    expect(intervalsStatus(facts({ hasActivePlan: false, intervalsIcuLastPushAt: null }), now))
      .toMatchObject({ level: "ok", label: "Ligado" });
  });

  it("says when the threshold has not been checked yet", () => {
    expect(intervalsStatus(facts({ intervalsIcuHasRunThreshold: null }), now).detail).toBe("Ritmo de limiar por verificar");
  });
});

describe("helpers", () => {
  it("orders levels by severity", () => {
    expect(worstLevel("ok", "warning")).toBe("warning");
    expect(worstLevel("off", "error", "warning")).toBe("error");
    expect(worstLevel("off", "off")).toBe("off");
  });

  it("speaks in days", () => {
    expect(daysAgo(ago(0.2), now)).toBe("hoje");
    expect(daysAgo(ago(1.5), now)).toBe("ontem");
    expect(daysAgo(ago(12), now)).toBe("há 12 dias");
  });
});
