import { describe, it, expect } from "vitest";
import { capFirstWeek, weekVolume } from "@/lib/week-volume";

const s = (sessionType: string, km: number, min: number) => ({
  sessionType, plannedDistanceKm: km, plannedDurationMin: min,
});

/** A semana 1 real do plano de 21 de setembro: 48 km para quem fazia 40,3. */
const semana48 = () => ({
  weekNumber: 1,
  sessions: [s("EASY", 8, 52), s("TEMPO", 10, 60), s("EASY", 6, 40), s("INTERVALS", 10, 62), s("LONG", 14, 95)],
});
const semana2 = () => ({ weekNumber: 2, sessions: [s("EASY", 9, 58), s("LONG", 16, 108)] });

describe("capFirstWeek", () => {
  it("encolhe a primeira semana até 10% acima do pico recente", () => {
    // O caso que aconteceu: começar 19% acima do que o atleta fazia, e depois
    // progredir corretamente a partir de um ponto de partida errado.
    const { weeks, capped } = capFirstWeek([semana48(), semana2()], 40.3);

    expect(capped).toMatchObject({ from: 48, peak: 40.3 });
    expect(capped!.to).toBeLessThanOrEqual(44.4);
    expect(weekVolume(weeks[0].sessions).km).toBeLessThanOrEqual(44.4);
  });

  it("deixa em paz tudo o que vem depois", () => {
    // A progressão a partir daqui é do modelo; só o ponto de partida é nosso.
    const { weeks } = capFirstWeek([semana48(), semana2()], 40.3);
    expect(weeks[1]).toEqual(semana2());
  });

  it("não mexe numa semana que já está dentro", () => {
    const entrada = [{ weekNumber: 1, sessions: [s("EASY", 10, 65), s("LONG", 14, 95)] }];
    const { weeks, capped } = capFirstWeek(entrada, 40.3);
    expect(capped).toBeNull();
    expect(weeks).toEqual(entrada);
  });

  it("nunca aumenta uma semana curta", () => {
    // Uma primeira semana leve pode ser de propósito — regresso de lesão,
    // semana de prova. Encher-lhe o volume seria inventar treino.
    const leve = [{ weekNumber: 1, sessions: [s("EASY", 5, 35)] }];
    const { weeks, capped } = capFirstWeek(leve, 40.3);
    expect(capped).toBeNull();
    expect(weeks).toEqual(leve);
  });

  it("mantém o ritmo implícito de cada sessão", () => {
    // Distância e duração descem juntas: encurtar só a distância transformaria
    // uma corrida fácil num treino mais rápido sem o dizer a ninguém.
    const { weeks } = capFirstWeek([semana48()], 40.3);
    const antes = semana48().sessions[0];
    const depois = weeks[0].sessions[0];
    const ritmoAntes = antes.plannedDurationMin / antes.plannedDistanceKm;
    const ritmoDepois = depois.plannedDurationMin! / depois.plannedDistanceKm!;
    expect(Math.abs(ritmoDepois - ritmoAntes)).toBeLessThan(0.15);
  });

  it("não toca na distância de uma prova", () => {
    const comProva = [{
      weekNumber: 1,
      sessions: [s("EASY", 8, 52), s("RACE", 21.1, 125), s("EASY", 10, 65), s("LONG", 14, 95)],
    }];
    const { weeks } = capFirstWeek(comProva, 40.3);
    const prova = weeks[0].sessions.find(x => x.sessionType === "RACE")!;
    expect(prova.plannedDistanceKm).toBe(21.1);
    expect(weekVolume(weeks[0].sessions).km).toBeLessThanOrEqual(44.4);
  });

  it("desiste quando é a própria prova que faz exceder o limite", () => {
    // Não há forma honesta de encolher uma semana à volta de uma distância
    // fixa; cortar o treino em silêncio seria pior do que deixar isto à vista.
    const maratona = [{ weekNumber: 1, sessions: [s("RACE", 42.2, 240), s("EASY", 5, 35)] }];
    const { weeks, capped } = capFirstWeek(maratona, 30);
    expect(capped).toBeNull();
    expect(weeks).toEqual(maratona);
  });

  it("não faz nada sem histórico com que comparar", () => {
    // Um atleta novo não tem pico recente. Aí o plano parte do nível declarado,
    // e não há nada aqui que o possa verificar.
    expect(capFirstWeek([semana48()], null).capped).toBeNull();
    expect(capFirstWeek([semana48()], 0).capped).toBeNull();
    expect(capFirstWeek([], 40.3).capped).toBeNull();
  });

  it("encontra a primeira semana mesmo que não se chame 1", () => {
    // O job que estende o plano gera lotes que começam na semana 9.
    const lote = [{ weekNumber: 9, sessions: semana48().sessions }, { weekNumber: 10, sessions: [] }];
    const { capped } = capFirstWeek(lote, 40.3);
    expect(capped).toMatchObject({ from: 48 });
  });
});
