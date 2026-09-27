import { describe, it, expect, vi, beforeEach } from "vitest";

// The write path, with the database stood in for. placeRaces itself is covered
// in secondary-races.test.ts; what matters here is that what it decides is what
// actually reaches the plan — a displaced session cancelled, the race created,
// the week's totals brought back in line.
const db = vi.hoisted(() => ({
  trainingPlan: { findFirst: vi.fn() },
  event: { findMany: vi.fn() },
  trainingWeek: { findMany: vi.fn(), update: vi.fn() },
  trainingSession: { update: vi.fn(), create: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

const PLAN_START = new Date("2026-09-28T00:00:00");

/** Sunday 11 October is day 7 of week 2. */
const DOMINGO = new Date("2026-10-11T00:00:00");

function semanaComLongo() {
  return [
    {
      id: "w2",
      weekNumber: 2,
      startDate: new Date("2026-10-05T00:00:00"),
      sessions: [
        {
          id: "s-longo", dayOfWeek: 7, sport: "RUNNING", sessionType: "LONG",
          name: "Longo Z2", plannedDistance: 18, plannedDuration: 110,
          plannedPace: "6:00/km", isPriority: true,
        },
        {
          id: "s-facil", dayOfWeek: 2, sport: "RUNNING", sessionType: "EASY",
          name: "Corrida Fácil Z2", plannedDistance: 8, plannedDuration: 50,
          plannedPace: "6:30/km", isPriority: false,
        },
      ],
    },
  ];
}

beforeEach(() => {
  vi.clearAllMocks();
  db.trainingPlan.findFirst.mockResolvedValue({
    id: "p1", eventId: "e-alvo", startDate: PLAN_START,
    event: { date: new Date("2026-11-15T00:00:00") },
  });
  db.event.findMany.mockResolvedValue([
    { name: "Meia de Coimbra", date: DOMINGO, distance: "HALF_MARATHON", sport: "RUNNING", priority: "B" },
  ]);
  db.trainingWeek.findMany.mockResolvedValue(semanaComLongo());
});

describe("applyRacesToPlan", () => {
  it("cancela o que a prova desloca e cria a sessão da prova", async () => {
    const { applyRacesToPlan } = await import("@/lib/secondary-races");
    const r = await applyRacesToPlan("a1", "p1");

    expect(db.trainingSession.update).toHaveBeenCalledWith({
      where: { id: "s-longo" },
      data: { cancelled: true },
    });
    expect(db.trainingSession.create).toHaveBeenCalledTimes(1);
    const criada = db.trainingSession.create.mock.calls[0][0].data;
    expect(criada).toMatchObject({
      weekId: "w2", dayOfWeek: 7, sessionType: "RACE",
      name: "Meia de Coimbra", plannedDistance: 21.1,
    });
    expect(criada.date.getDate()).toBe(11);
    expect(r).toMatchObject({ created: 1, cancelled: 1, weekIds: ["w2"] });
  });

  it("volta a pôr os totais da semana de acordo com o que ela passou a ter", async () => {
    const { applyRacesToPlan } = await import("@/lib/secondary-races");
    await applyRacesToPlan("a1", "p1");

    // 8 km da fácil + 21,1 da prova. O longo de 18 saiu.
    expect(db.trainingWeek.update).toHaveBeenCalledWith({
      where: { id: "w2" },
      data: { totalDistance: 29.1, totalDuration: 50 },
    });
  });

  it("não toca em nada quando não há outras provas", async () => {
    db.event.findMany.mockResolvedValue([]);
    const { applyRacesToPlan } = await import("@/lib/secondary-races");
    const r = await applyRacesToPlan("a1", "p1");

    expect(db.trainingWeek.findMany).not.toHaveBeenCalled();
    expect(db.trainingSession.update).not.toHaveBeenCalled();
    expect(db.trainingSession.create).not.toHaveBeenCalled();
    expect(r).toMatchObject({ created: 0, cancelled: 0, updated: 0, weekIds: [] });
  });

  it("não escreve nada para um plano que não é do atleta", async () => {
    db.trainingPlan.findFirst.mockResolvedValue(null);
    const { applyRacesToPlan } = await import("@/lib/secondary-races");
    const r = await applyRacesToPlan("outro", "p1");

    expect(db.event.findMany).not.toHaveBeenCalled();
    expect(r.weekIds).toEqual([]);
  });

  it("alivia um treino duro na véspera em vez de o apagar", async () => {
    // Intervalos no sábado, prova no domingo: a véspera fica livre, e o que lá
    // estava é cancelado — é isso que placeRaces decide para o dia -1.
    db.trainingWeek.findMany.mockResolvedValue([
      {
        id: "w2", weekNumber: 2, startDate: new Date("2026-10-05T00:00:00"),
        sessions: [
          {
            id: "s-int", dayOfWeek: 6, sport: "RUNNING", sessionType: "INTERVALS",
            name: "Intervalos Z5", plannedDistance: 10, plannedDuration: 60,
            plannedPace: null, isPriority: false,
          },
          {
            id: "s-qui", dayOfWeek: 4, sport: "RUNNING", sessionType: "TEMPO",
            name: "Tempo Z3", plannedDistance: 12, plannedDuration: 65,
            plannedPace: null, isPriority: false,
          },
        ],
      },
    ]);
    const { applyRacesToPlan } = await import("@/lib/secondary-races");
    await applyRacesToPlan("a1", "p1");

    // Sábado (véspera) sai.
    expect(db.trainingSession.update).toHaveBeenCalledWith({
      where: { id: "s-int" }, data: { cancelled: true },
    });
    // Quinta (três dias antes) é aliviada, não cancelada — e perde a prosa, que
    // descrevia um treino que já não é aquele.
    const quinta = db.trainingSession.update.mock.calls
      .map(c => c[0])
      .find(c => c.where.id === "s-qui");
    expect(quinta.data).toMatchObject({ sessionType: "EASY", mainSet: null, coachTip: null });
    expect(quinta.data.name).toContain("pré-prova");
    expect(quinta.data.plannedDistance).toBeLessThan(12);
  });
});
