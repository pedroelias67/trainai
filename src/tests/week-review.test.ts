import { describe, it, expect } from "vitest";
import { formatWeekReview, reviewWeek, type ActivityRow, type PlannedRow } from "@/lib/week-review";

// A semana real de 16 a 22 de novembro de 2026, que deu origem a isto.
const sessao = (over: Partial<PlannedRow>): PlannedRow => ({
  id: "s", date: new Date("2026-11-18T00:00:00Z"), sessionType: "EASY", name: "Sessão",
  sport: "RUNNING", plannedDistance: 5, plannedDuration: 35, plannedPace: "6:45/km",
  completed: false, activityId: null, ...over,
});

const atividade = (over: Partial<ActivityRow>): ActivityRow => ({
  id: "a", date: new Date("2026-11-18T09:11:00Z"), name: "Corrida matinal", sport: "RUNNING",
  distance: 9500, duration: 3100, avgHR: 155, avgPace: "5:26/km", trainingLoad: null, ...over,
});

describe("reviewWeek", () => {
  it("mantém o emparelhamento que a app já tinha feito", () => {
    // O defeito: a análise recebia duas listas soltas e concluía que os
    // intervalos não tinham sido feitos, porque a corrida se chamava
    // "Corrida matinal" e não "Intervalos".
    const r = reviewWeek(
      [sessao({ id: "s1", sessionType: "INTERVALS", name: "Intervalos 5x600m", completed: true, activityId: "a1" })],
      [atividade({ id: "a1" })]
    );

    expect(r.sessions[0].done).toMatchObject({ distanceKm: 9.5, avgPace: "5:26/km", avgHR: 155 });
    expect(r.extra).toEqual([]);
  });

  it("diz o dia da semana, que antes não ia de todo", () => {
    const r = reviewWeek([sessao({ date: new Date("2026-11-18T00:00:00Z") })], []);
    expect(r.sessions[0].day).toBe("quarta-feira, 2026-11-18");
  });

  it("marca como não feita só o que não foi feito", () => {
    const r = reviewWeek(
      [
        sessao({ id: "s1", name: "Feita", completed: true, activityId: "a1" }),
        sessao({ id: "s2", name: "Por fazer", date: new Date("2026-11-21T00:00:00Z") }),
      ],
      [atividade({ id: "a1" })]
    );
    expect(r.sessions.find(s => s.name === "Feita")!.done).not.toBeNull();
    expect(r.sessions.find(s => s.name === "Por fazer")!.done).toBeNull();
  });

  it("aceita uma sessão marcada à mão, sem atividade ligada", () => {
    // O atleta disse que a fez. Chamar-lhe não feita seria contradizê-lo.
    const r = reviewWeek([sessao({ completed: true, activityId: null })], []);
    expect(r.sessions[0].done).toEqual({});
  });

  it("separa o treino que não estava no plano", () => {
    const r = reviewWeek(
      [sessao({ id: "s1", completed: true, activityId: "a1" })],
      [atividade({ id: "a1" }), atividade({ id: "a2", date: new Date("2026-11-15T10:31:00Z"), distance: 6300, avgPace: "6:46/km" })]
    );
    expect(r.extra).toHaveLength(1);
    expect(r.extra[0]).toMatchObject({ day: "domingo, 2026-11-15", distanceKm: 6.3 });
  });

  it("ordena as sessões pelo dia", () => {
    const r = reviewWeek(
      [
        sessao({ id: "s2", name: "Sábado", date: new Date("2026-11-21T00:00:00Z") }),
        sessao({ id: "s1", name: "Segunda", date: new Date("2026-11-16T00:00:00Z") }),
      ],
      []
    );
    expect(r.sessions.map(s => s.name)).toEqual(["Segunda", "Sábado"]);
  });
});

describe("formatWeekReview", () => {
  const revista = () =>
    reviewWeek(
      [
        sessao({ id: "s1", sessionType: "INTERVALS", name: "Intervalos 5x600m", plannedDistance: 6,
                 plannedPace: "4:35/km", completed: true, activityId: "a1" }),
        sessao({ id: "s2", name: "Corrida Fácil Z2", date: new Date("2026-11-21T00:00:00Z") }),
      ],
      [atividade({ id: "a1" }), atividade({ id: "a2", date: new Date("2026-11-15T10:31:00Z"), distance: 6300 })]
    );

  it("conta as realizadas e diz o que foi corrido em cada uma", () => {
    const t = formatWeekReview(revista());
    expect(t).toContain("1 de 2 realizadas");
    expect(t).toContain('quarta-feira, 2026-11-18 — INTERVALS "Intervalos 5x600m"');
    expect(t).toContain("FEITO: 9.5 km");
  });

  it("marca claramente o que ficou por fazer", () => {
    expect(formatWeekReview(revista())).toContain("NÃO FEITO");
  });

  it("proíbe o modelo de refazer o emparelhamento", () => {
    // A instrução é o que impede a conclusão errada a partir dos nomes.
    const t = formatWeekReview(revista());
    expect(t).toContain("Não voltes a emparelhar");
    expect(t).toContain("seja qual");
  });

  it("apresenta o treino extra como extra, não como falha", () => {
    const t = formatWeekReview(revista());
    expect(t).toContain("não é incumprimento");
  });

  it("omite a secção de extras quando não há nenhum", () => {
    const t = formatWeekReview(reviewWeek([sessao({ completed: true, activityId: "a1" })], [atividade({ id: "a1" })]));
    expect(t).not.toContain("FORA DO PLANO");
  });
});
