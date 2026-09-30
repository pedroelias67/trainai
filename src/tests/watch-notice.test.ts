import { describe, it, expect } from "vitest";
import { watchNotice, type ConnectionFacts } from "@/lib/connection-status";

const now = new Date("2026-09-30T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

const factos = (over: Partial<ConnectionFacts> = {}): ConnectionFacts => ({
  stravaConnected: true,
  stravaSyncError: null,
  stravaSyncErrorAt: null,
  lastActivityAt: new Date(now.getTime() - DAY),
  intervalsConnected: true,
  intervalsIcuLastPushAt: new Date(now.getTime() - DAY),
  intervalsIcuPushError: null,
  intervalsIcuHasRunThreshold: true,
  intervalsIcuWeekOnCalendar: true,
  hasActivePlan: true,
  ...over,
});

describe("watchNotice", () => {
  it("cala-se quando está tudo bem", () => {
    expect(watchNotice(factos(), now)).toBeNull();
  });

  it("cala-se para quem ainda não tem plano", () => {
    // Sem treinos para entregar, um aviso sobre o relógio é só ruído.
    expect(watchNotice(factos({ hasActivePlan: false, intervalsConnected: false }), now)).toBeNull();
  });

  it("avisa quem tem plano e não ligou o Intervals", () => {
    // O caso que ninguém via: o Strava traz as atividades, a análise funciona,
    // e os treinos planeados nunca chegam ao relógio.
    const aviso = watchNotice(factos({ intervalsConnected: false }), now);
    expect(aviso).toMatchObject({ level: "warning" });
    expect(aviso!.title).toContain("não estão a chegar");
    expect(aviso!.action.href).toBe("/dashboard/profile");
  });

  it("avisa sobre o ritmo de limiar e manda ao sítio certo", () => {
    const aviso = watchNotice(factos({ intervalsIcuHasRunThreshold: false }), now);
    expect(aviso!.title).toContain("sem ritmo");
    expect(aviso!.detail).toContain("Ritmo de Limiar");
    expect(aviso!.action).toMatchObject({ href: "https://intervals.icu/settings", external: true });
  });

  it("põe o ritmo de limiar à frente da semana por enviar", () => {
    // Um treino sem alvos de ritmo é pior do que um treino que ainda não foi
    // enviado: este dá para enviar, aquele parece estar certo e não está.
    const aviso = watchNotice(
      factos({ intervalsIcuHasRunThreshold: false, intervalsIcuWeekOnCalendar: false }),
      now
    );
    expect(aviso!.title).toContain("sem ritmo");
  });

  it("diz quando a semana não está no relógio", () => {
    const aviso = watchNotice(factos({ intervalsIcuWeekOnCalendar: false }), now);
    expect(aviso!.title).toContain("semana atual");
    expect(aviso!.action.href).toBe("/dashboard/plan");
  });

  it("trata uma falha de envio como erro, com o motivo", () => {
    const aviso = watchNotice(factos({ intervalsIcuPushError: "401 Unauthorized" }), now);
    expect(aviso).toMatchObject({ level: "error" });
    expect(aviso!.detail).toContain("401");
  });

  it("nota uma semana inteira de silêncio", () => {
    const aviso = watchNotice(
      factos({
        intervalsIcuWeekOnCalendar: null,
        intervalsIcuLastPushAt: new Date(now.getTime() - 9 * DAY),
      }),
      now
    );
    expect(aviso!.title).toContain("não se envia");
  });

  it("não inventa um aviso para quem nunca enviou mas tem a semana no calendário", () => {
    // O calendário é a prova; a falta de registo de envio não é.
    expect(
      watchNotice(factos({ intervalsIcuLastPushAt: null, intervalsIcuWeekOnCalendar: true }), now)
    ).toBeNull();
  });
});
