import { describe, it, expect } from "vitest";
import {
  estimateThresholdPace, formatPace, thresholdGuidance, thresholdPaceFromVdot,
} from "@/lib/threshold-pace";

const now = new Date("2026-10-26T12:00:00Z");

describe("thresholdPaceFromVdot", () => {
  it("concorda com as tabelas de Daniels", () => {
    // A curva é invertida aqui em vez de copiada de uma tabela, por isso o que
    // se exige é concordância, não identidade: as tabelas publicadas estão
    // arredondadas aos cinco segundos. VDOT 50 cai exatamente em 4:15/km.
    expect(formatPace(thresholdPaceFromVdot(50)!)).toBe("4:15");

    const tabela: Array<[number, number]> = [[40, 305], [50, 255], [60, 220]];
    for (const [v, segundos] of tabela) {
      expect(Math.abs(thresholdPaceFromVdot(v)! - segundos)).toBeLessThanOrEqual(3);
    }
  });

  it("devolve nada para um valor que não é um VDOT", () => {
    expect(thresholdPaceFromVdot(0)).toBeNull();
    expect(thresholdPaceFromVdot(-5)).toBeNull();
    expect(thresholdPaceFromVdot(NaN)).toBeNull();
  });
});

describe("estimateThresholdPace — ordem de confiança", () => {
  const marcas = [
    { distance: 10000, timeSeconds: 2947, date: new Date("2026-10-25") }, // 4:55/km
  ];

  it("usa o que o atleta definiu, acima de tudo o resto", () => {
    const t = estimateThresholdPace(
      { declared: "4:30", records: marcas, fitnessLevel: "BEGINNER", age: 58 },
      now
    );
    expect(t).toMatchObject({ pace: "4:30", source: "declared", trustworthy: true });
  });

  it("usa o histórico quando não há valor definido", () => {
    const t = estimateThresholdPace(
      { declared: null, records: marcas, fitnessLevel: "ADVANCED", age: 58 },
      now
    );
    expect(t.source).toBe("records");
    expect(t.trustworthy).toBe(true);
    expect(t.basis).toContain("10 km");
    // 10 km em 49:07 dá VDOT ~41, e limiar perto de 5:00/km.
    expect(t.secondsPerKm).toBeGreaterThan(290);
    expect(t.secondsPerKm).toBeLessThan(310);
  });

  it("prefere o histórico à estimativa por nível, mesmo que o nível diga outra coisa", () => {
    // O nível diz ELITE; a corrida dele diz outra coisa. Vence a corrida.
    const t = estimateThresholdPace(
      { records: marcas, fitnessLevel: "ELITE", age: 30 },
      now
    );
    expect(t.source).toBe("records");
    expect(t.secondsPerKm).toBeGreaterThan(280);
  });

  it("estima pelo nível e idade quando não há corridas nenhumas", () => {
    const t = estimateThresholdPace({ records: [], fitnessLevel: "INTERMEDIATE", age: 30 }, now);
    expect(t).toMatchObject({ source: "estimated", trustworthy: false });
    expect(t.pace).toBe("5:30");
    expect(t.basis).toContain("ainda não haver corridas");
  });

  it("não deixa a estimativa ser gravada como se fosse medida", () => {
    const t = estimateThresholdPace({ fitnessLevel: "ADVANCED" }, now);
    expect(t.trustworthy).toBe(false);
  });

  it("abranda a estimativa com a idade", () => {
    const novo = estimateThresholdPace({ fitnessLevel: "ADVANCED", age: 30 }, now);
    const veterano = estimateThresholdPace({ fitnessLevel: "ADVANCED", age: 58 }, now);
    expect(veterano.secondsPerKm).toBeGreaterThan(novo.secondsPerKm);
    // Sem exageros: um veterano de 58 não é o dobro mais lento.
    expect(veterano.secondsPerKm / novo.secondsPerKm).toBeLessThan(1.25);
  });

  it("ignora uma marca velha de mais e cai na estimativa", () => {
    const antiga = [{ distance: 10000, timeSeconds: 2400, date: new Date("2023-01-01") }];
    const t = estimateThresholdPace({ records: antiga, fitnessLevel: "INTERMEDIATE", age: 30 }, now);
    expect(t.source).toBe("estimated");
  });
});

describe("thresholdGuidance", () => {
  it("escreve os ritmos a partir do limiar, não do nível", () => {
    const texto = thresholdGuidance(estimateThresholdPace({ declared: "5:00" }, now));
    expect(texto).toContain("RITMO DE LIMIAR: 5:00/km");
    expect(texto).toContain("6:15");  // fácil: limiar + 75s
    expect(texto).toContain("4:40");  // intervalos: limiar - 20s
    expect(texto).not.toContain("ponto de partida");
  });

  it("avisa o modelo quando o número é um palpite", () => {
    const texto = thresholdGuidance(estimateThresholdPace({ fitnessLevel: "BEGINNER" }, now));
    expect(texto).toContain("ponto de partida");
    expect(texto).toContain("conservadora");
  });
});
