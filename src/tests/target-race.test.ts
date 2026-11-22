import { describe, it, expect } from "vitest";
import { placeTargetRace, type SkeletonSession, type SkeletonWeek } from "@/lib/secondary-races";

// 30 de novembro de 2026 é segunda-feira; 12 de dezembro é sábado.
const PLAN_START = new Date("2026-11-30T00:00:00Z");
const PROVA = { name: "PROVA — São Silvestre", date: new Date("2026-12-12T00:00:00Z"), distance: "TEN_K", sport: "RUNNING" };

const s = (dayOfWeek: number, sessionType: string, name: string): SkeletonSession => ({
  dayOfWeek, sport: "RUNNING", sessionType, name,
  plannedDistanceKm: 5, plannedDurationMin: 34, plannedPace: "6:40/km", isPriority: false,
});

/** A última semana tal como o modelo a escreveu: prova no domingo, véspera no sábado. */
const comoVeio = (): SkeletonWeek[] => [
  { weekNumber: 1, sessions: [s(1, "EASY", "Leve"), s(3, "INTERVALS", "Strides")] },
  { weekNumber: 2, sessions: [s(1, "EASY", "Leve"), s(6, "EASY", "Ativação Pré-Prova"), s(7, "RACE", "PROVA — São Silvestre")] },
];

describe("placeTargetRace", () => {
  it("põe a prova no dia em que ela se corre", () => {
    // O defeito: prova ao sábado, sessão no domingo. O atleta recebia um
    // aquecimento na manhã da prova e um 10K no dia seguinte.
    const { weeks, moved } = placeTargetRace(comoVeio(), PROVA, PLAN_START);
    expect(moved).toBe(true);

    const ultima = weeks.find(w => w.weekNumber === 2)!;
    const corrida = ultima.sessions.find(x => x.sessionType === "RACE")!;
    expect(corrida.dayOfWeek).toBe(6); // sábado
    expect(corrida.plannedDistanceKm).toBe(10);
  });

  it("tira o que o modelo tinha posto nesse dia", () => {
    const { weeks } = placeTargetRace(comoVeio(), PROVA, PLAN_START);
    const sabado = weeks.find(w => w.weekNumber === 2)!.sessions.filter(x => x.dayOfWeek === 6);
    expect(sabado).toHaveLength(1);
    expect(sabado[0].sessionType).toBe("RACE");
  });

  it("não deixa uma segunda prova noutro dia", () => {
    const todas = placeTargetRace(comoVeio(), PROVA, PLAN_START)
      .weeks.flatMap(w => w.sessions).filter(x => x.sessionType === "RACE");
    expect(todas).toHaveLength(1);
  });

  it("não mexe quando já está certo", () => {
    const certo: SkeletonWeek[] = [{ weekNumber: 2, sessions: [s(1, "EASY", "Leve"), s(6, "RACE", "PROVA")] }];
    const { weeks, moved } = placeTargetRace(certo, PROVA, PLAN_START);
    expect(moved).toBe(false);
    expect(weeks).toEqual(certo);
  });

  it("cria a sessão se o modelo se esqueceu dela", () => {
    const semProva: SkeletonWeek[] = [{ weekNumber: 2, sessions: [s(1, "EASY", "Leve")] }];
    const { weeks } = placeTargetRace(semProva, PROVA, PLAN_START);
    const corrida = weeks[0].sessions.find(x => x.sessionType === "RACE")!;
    expect(corrida).toMatchObject({ dayOfWeek: 6, name: "PROVA — São Silvestre" });
  });

  it("deixa as semanas anteriores em paz", () => {
    const { weeks } = placeTargetRace(comoVeio(), PROVA, PLAN_START);
    expect(weeks.find(w => w.weekNumber === 1)).toEqual(comoVeio()[0]);
  });

  it("não faz nada se a prova cair fora das semanas escritas", () => {
    const longe = { ...PROVA, date: new Date("2027-03-01T00:00:00Z") };
    const entrada = comoVeio();
    const { weeks, moved } = placeTargetRace(entrada, longe, PLAN_START);
    expect(moved).toBe(false);
    expect(weeks).toEqual(entrada);
  });
});
