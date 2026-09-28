import { describe, it, expect } from "vitest";
import {
  placeRaces, secondaryRaceGuidance,
  type SecondaryRace, type SkeletonSession, type SkeletonWeek,
} from "@/lib/secondary-races";

// 28 September 2026 is a Monday, which is what the week grid is anchored to.
const PLAN_START = new Date("2026-09-28T00:00:00");

const sessao = (
  dayOfWeek: number,
  sessionType: string,
  name: string,
  km?: number,
  min?: number
): SkeletonSession => ({
  dayOfWeek, sport: "RUNNING", sessionType, name,
  plannedDistanceKm: km ?? null, plannedDurationMin: min ?? null,
  plannedPace: null, isPriority: false,
});

/** A plain three-week block: easy Monday, intervals Wednesday, tempo Friday, long Sunday. */
const bloco = (): SkeletonWeek[] =>
  [1, 2, 3].map(weekNumber => ({
    weekNumber,
    focus: `semana ${weekNumber}`,
    sessions: [
      sessao(1, "EASY", "Corrida Fácil Z2", 8, 50),
      sessao(3, "INTERVALS", "Intervalos Z5", 10, 60),
      sessao(5, "TEMPO", "Tempo Z3", 12, 65),
      sessao(7, "LONG", "Longo Z2", 18, 110),
    ],
    totalDistanceKm: 48,
    totalDurationMin: 285,
  })) as SkeletonWeek[];

const prova = (date: string, priority: "A" | "B" | "C", distance = "TEN_K"): SecondaryRace => ({
  name: `Prova ${priority}`, date: new Date(`${date}T00:00:00`), distance, sport: "RUNNING", priority,
});

const semana = (weeks: SkeletonWeek[], n: number) => weeks.find(w => w.weekNumber === n)!;
const dia = (weeks: SkeletonWeek[], n: number, d: number) =>
  semana(weeks, n).sessions.find(s => s.dayOfWeek === d);

describe("placeRaces — a prova aparece no dia certo", () => {
  it("põe a prova na sua data e tira o que lá estava", () => {
    // Domingo 11/10 é o dia 7 da semana 2, onde estava o longo.
    const { weeks, placed } = placeRaces(bloco(), [prova("2026-10-11", "B")], PLAN_START);

    const corrida = dia(weeks, 2, 7);
    expect(corrida).toMatchObject({ sessionType: "RACE", name: "Prova B", plannedDistanceKm: 10 });
    expect(placed[0].weekNumber).toBe(2);
    expect(placed[0].changes.join(" ")).toContain("Longo Z2");
  });

  it("ignora uma prova fora das semanas já escritas", () => {
    // O bloco tem três semanas; esta prova cai na sexta.
    const { weeks, placed } = placeRaces(bloco(), [prova("2026-11-08", "B")], PLAN_START);
    expect(placed).toEqual([]);
    expect(weeks).toEqual(bloco());
  });

  it("aplica o que a prova pede aos dias vizinhos, mesmo estando fora do lote", () => {
    // O plano é escrito em lotes. Esta prova é no domingo da semana 1, que já
    // existe; o lote em mãos é só a semana 2, e é lá que cai o dia seguinte.
    const soSemana2 = [semana(bloco(), 2)];
    const { weeks, placed } = placeRaces(soSemana2, [prova("2026-10-04", "B")], PLAN_START);

    // A segunda-feira da semana 2 passa a recuperação, apesar de a prova estar
    // numa semana que não foi passada a esta chamada.
    expect(dia(weeks, 2, 1)).toMatchObject({ sessionType: "RECOVERY" });
    // E nenhuma sessão RACE foi inventada numa semana que não é a da prova.
    expect(weeks.flatMap(w => w.sessions).filter(s => s.sessionType === "RACE")).toHaveLength(0);
    expect(placed[0].changes.join(" ")).toContain("dia seguinte");
  });

  it("não reporta uma prova fora do lote que não mexeu em nada", () => {
    // Semana 3 em mãos, prova no domingo da semana 1: nada ali lhe diz respeito.
    const { placed } = placeRaces([semana(bloco(), 3)], [prova("2026-10-04", "B")], PLAN_START);
    expect(placed).toEqual([]);
  });

  it("recalcula os totais da semana que mexeu", () => {
    const { weeks } = placeRaces(bloco(), [prova("2026-10-11", "B")], PLAN_START);
    const s2 = semana(weeks, 2);
    const soma = s2.sessions.reduce((t, s) => t + (s.plannedDistanceKm ?? 0), 0);
    expect(s2.totalDistanceKm).toBeCloseTo(soma, 1);
    expect(s2.totalDistanceKm).not.toBe(48);
    // As semanas intocadas ficam como estavam.
    expect(semana(weeks, 1)).toEqual(semana(bloco(), 1));
  });
});

describe("placeRaces — prova B", () => {
  const resultado = () => placeRaces(bloco(), [prova("2026-10-11", "B")], PLAN_START);

  it("deixa a véspera livre", () => {
    // Sábado 10/10 é a véspera da prova de domingo; põe-se lá algo para ver sair.
    const semanas = bloco();
    semana(semanas, 2).sessions.push(sessao(6, "EASY", "Solta pernas", 5, 30));
    semana(semanas, 2).sessions.sort((a, b) => a.dayOfWeek - b.dayOfWeek);

    const { weeks, placed } = placeRaces(semanas, [prova("2026-10-11", "B")], PLAN_START);
    expect(dia(weeks, 2, 6)).toBeUndefined();
    expect(placed[0].changes.join(" ")).toContain("Véspera livre");
  });

  it("alivia o trabalho duro dos dois e três dias antes", () => {
    const { weeks } = resultado();
    // Quinta 08/10 (dia 4) não tinha nada. Sexta 09/10 (dia 5) tinha tempo — dois dias antes.
    const sexta = dia(weeks, 2, 5);
    expect(sexta).toMatchObject({ sessionType: "EASY" });
    expect(sexta!.name).toContain("pré-prova");
    // E encurtado, não apenas renomeado.
    expect(sexta!.plannedDistanceKm).toBeLessThan(12);
  });

  it("não toca nas sessões fáceis dos dias anteriores", () => {
    // Só o trabalho duro é que alivia; uma corrida fácil três dias antes fica.
    const semanas: SkeletonWeek[] = [{
      weekNumber: 1,
      sessions: [sessao(4, "EASY", "Corrida Fácil Z2", 8, 50), sessao(7, "LONG", "Longo Z2", 18, 110)],
    }];
    const { weeks } = placeRaces(semanas, [prova("2026-10-04", "B")], PLAN_START);
    expect(dia(weeks, 1, 4)).toMatchObject({ sessionType: "EASY", name: "Corrida Fácil Z2", plannedDistanceKm: 8 });
  });

  it("põe o dia seguinte em recuperação, mesmo que caia na semana a seguir", () => {
    const { weeks } = resultado();
    // Segunda 12/10 é o dia 1 da semana 3, e tinha uma corrida fácil.
    expect(dia(weeks, 3, 1)).toMatchObject({ sessionType: "RECOVERY", name: "Recuperação (pós-prova)" });
  });

  it("deixa a prova fazer de longo quando é comprida", () => {
    // Meia maratona (21,1 km) contra um longo de 18: a prova substitui-o.
    const { weeks, placed } = placeRaces(
      bloco(), [prova("2026-10-09", "B", "HALF_MARATHON")], PLAN_START
    );
    expect(semana(weeks, 2).sessions.filter(s => s.sessionType === "LONG")).toHaveLength(0);
    expect(placed[0].changes.join(" ")).toContain("faz de longo");
  });

  it("mantém o longo quando a prova é curta", () => {
    // 5 km contra um longo de 18 não substitui nada.
    const { weeks } = placeRaces(bloco(), [prova("2026-10-07", "B", "FIVE_K")], PLAN_START);
    expect(semana(weeks, 2).sessions.filter(s => s.sessionType === "LONG")).toHaveLength(1);
  });
});

describe("placeRaces — prova C", () => {
  it("ocupa o lugar do treino duro mais próximo, deixando a semana espaçada", () => {
    // Domingo 04/10, semana 1: intervalos na quarta, tempo na sexta. Sai o
    // tempo, que é o que estava perto da prova; os intervalos de quarta ficam.
    const { weeks, placed } = placeRaces(bloco(), [prova("2026-10-04", "C")], PLAN_START);
    const s1 = semana(weeks, 1);
    expect(s1.sessions.filter(s => s.sessionType === "TEMPO")).toHaveLength(0);
    expect(s1.sessions.filter(s => s.sessionType === "INTERVALS")).toHaveLength(1);
    expect(placed[0].changes.join(" ")).toContain("treino duro da semana");
  });

  it("não deixa qualidade na véspera, mesmo que ela caia na semana anterior", () => {
    // Prova à segunda-feira 05/10 (semana 2, dia 1). A véspera é o domingo 04/10,
    // que pertence à semana 1 — fora do alcance da substituição, que só olha para
    // a semana da prova. É este o caso que a regra da véspera existe para apanhar.
    const semanas = bloco();
    semana(semanas, 1).sessions = [
      sessao(3, "EASY", "Corrida Fácil Z2", 8, 50),
      sessao(7, "TEMPO", "Tempo Z3", 12, 65),
    ];

    const { weeks } = placeRaces(semanas, [prova("2026-10-05", "C")], PLAN_START);
    const domingo = dia(weeks, 1, 7);
    expect(domingo).toMatchObject({ sessionType: "EASY" });
    expect(domingo!.name).toContain("véspera");
    expect(domingo!.plannedDistanceKm).toBeLessThan(12);
    // E a prova ficou onde devia.
    expect(dia(weeks, 2, 1)).toMatchObject({ sessionType: "RACE" });
  });

  it("não alivia os dias anteriores como faria uma prova B", () => {
    // Quarta-feira mantém-se dura quando a prova C é no domingo.
    const semanas: SkeletonWeek[] = [{
      weekNumber: 1,
      sessions: [sessao(3, "TEMPO", "Tempo Z3", 12, 65), sessao(5, "EASY", "Fácil", 8, 50)],
    }];
    const { weeks } = placeRaces(semanas, [prova("2026-10-04", "C")], PLAN_START);
    // O tempo de quarta é o treino duro da semana, logo sai por substituição —
    // mas a fácil de sexta, dois dias antes, não é tocada.
    expect(dia(weeks, 1, 5)).toMatchObject({ sessionType: "EASY", plannedDistanceKm: 8 });
  });
});

describe("placeRaces — prova marcada A", () => {
  it("prepara-a como B e diz porquê", () => {
    const { weeks, placed } = placeRaces(bloco(), [prova("2026-10-11", "A")], PLAN_START);
    expect(placed[0].changes[0]).toContain("objetivo principal");
    // E recebe o tratamento de B: véspera e dia seguinte.
    expect(dia(weeks, 3, 1)).toMatchObject({ sessionType: "RECOVERY" });
  });
});

describe("placeRaces — várias provas", () => {
  it("coloca-as todas, cada uma na sua semana", () => {
    const { weeks, placed } = placeRaces(
      bloco(),
      [prova("2026-10-11", "B"), prova("2026-10-04", "C")],
      PLAN_START
    );
    expect(placed.map(p => p.weekNumber)).toEqual([1, 2]); // ordenadas por data
    expect(dia(weeks, 1, 7)).toMatchObject({ sessionType: "RACE" });
    expect(dia(weeks, 2, 7)).toMatchObject({ sessionType: "RACE" });
  });

  it("não deixa duas sessões no mesmo dia", () => {
    const { weeks } = placeRaces(bloco(), [prova("2026-10-07", "B")], PLAN_START);
    for (const w of weeks) {
      const dias = w.sessions.map(s => s.dayOfWeek);
      expect(new Set(dias).size).toBe(dias.length);
      expect(dias).toEqual([...dias].sort((a, b) => a - b));
      for (const d of dias) expect(d).toBeGreaterThanOrEqual(1);
      for (const d of dias) expect(d).toBeLessThanOrEqual(7);
    }
  });
});

describe("secondaryRaceGuidance", () => {
  it("não diz nada quando não há outras provas", () => {
    expect(secondaryRaceGuidance([])).toBe("");
  });

  it("lista cada prova com data, distância e prioridade", () => {
    const texto = secondaryRaceGuidance([prova("2026-10-11", "B", "HALF_MARATHON")]);
    expect(texto).toContain("2026-10-11");
    expect(texto).toContain("Prova B");
    expect(texto).toContain("21.1 km");
    expect(texto).toContain("prioridade B");
  });
});

describe("placeRaces — o dia seguinte a uma prova B", () => {
  it("encurta a sessão, além de lhe mudar o nome", () => {
    // Chamar "recuperação" a uma base de 8 km inalterada só torna o rótulo falso.
    const semanas: SkeletonWeek[] = [
      { weekNumber: 1, sessions: [sessao(7, "LONG", "Longo Z2", 18, 110)] },
      { weekNumber: 2, sessions: [sessao(1, "EASY", "Corrida Base Z2", 8, 50)] },
    ];
    const { weeks } = placeRaces(semanas, [prova("2026-10-04", "B")], PLAN_START);

    const seguinte = dia(weeks, 2, 1);
    expect(seguinte).toMatchObject({ sessionType: "RECOVERY", name: "Recuperação (pós-prova)" });
    expect(seguinte!.plannedDistanceKm).toBe(4.8);
    expect(seguinte!.plannedDurationMin).toBe(30);
  });
});
