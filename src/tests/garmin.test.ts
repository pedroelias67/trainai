import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchGarminDays, garminWellnessSummary, obtainAccessToken, type GarminDayData } from "@/lib/garmin";

const TOKEN = { access_token: "tok-123" };

const SONO = [
  { calendarDate: "2026-11-10", sleepTimeSeconds: 25200, deepSleepSeconds: 4800, remSleepSeconds: 5400, awakeSleepSeconds: 900 },
  { calendarDate: "2026-11-11", sleepTimeSeconds: 18000, deepSleepSeconds: 2400, remSleepSeconds: 3000, awakeSleepSeconds: 1800 },
];
const HRV = {
  hrvSummaries: [
    { calendarDate: "2026-11-10", lastNightAvg: 62, weeklyAvg: 58, status: "BALANCED" },
    { calendarDate: "2026-11-12", lastNightAvg: 41, weeklyAvg: 57, status: "LOW" },
  ],
};

function responder(mapa: Record<string, { estado?: number; corpo?: unknown }>) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const chave = Object.keys(mapa).find(k => String(url).includes(k));
    const r = chave ? mapa[chave] : { estado: 404 };
    const estado = r.estado ?? 200;
    return {
      ok: estado >= 200 && estado < 300,
      status: estado,
      json: async () => r.corpo,
      text: async () => (typeof r.corpo === "string" ? r.corpo : JSON.stringify(r.corpo)),
      _metodo: init?.method,
    } as never;
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("obtainAccessToken", () => {
  beforeEach(() => vi.stubGlobal("fetch", responder({ "personal-api-key/token": { corpo: TOKEN } })));

  it("troca a chave por um token", async () => {
    const r = await obtainAccessToken("chave");
    expect(r).toEqual({ ok: true, data: "tok-123" });
  });

  it("aceita o token venha ele embrulhado ou em cru", async () => {
    // A documentação não diz a forma da resposta, e adivinhar mal lê-se como
    // "chave recusada" — que manda o atleta procurar o problema no sítio errado.
    for (const corpo of [{ accessToken: "a" }, { token: "a" }, "a"]) {
      vi.stubGlobal("fetch", responder({ "personal-api-key/token": { corpo } }));
      expect(await obtainAccessToken("k")).toEqual({ ok: true, data: "a" });
    }
  });

  it("diz o que fazer quando a chave é recusada", async () => {
    vi.stubGlobal("fetch", responder({ "personal-api-key/token": { estado: 401 } }));
    const r = await obtainAccessToken("errada");
    expect(r.ok).toBe(false);
    expect((r as { error: string }).error).toContain("expirou");
  });

  it("não rebenta quando a Garmin está em baixo", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("rede"); }));
    expect((await obtainAccessToken("k")).ok).toBe(false);
  });
});

describe("fetchGarminDays", () => {
  beforeEach(() => vi.stubGlobal("fetch", responder({
    "personal-api-key/token": { corpo: TOKEN },
    "dailySleepSummariesByDate": { corpo: SONO },
    "hrv-service": { corpo: HRV },
  })));

  it("junta sono e HRV pelo dia", async () => {
    const r = await fetchGarminDays("k", new Date("2026-11-10"), new Date("2026-11-12"));
    expect(r.ok).toBe(true);
    const dias = (r as { data: GarminDayData[] }).data;

    expect(dias.map(d => d.date)).toEqual(["2026-11-10", "2026-11-11", "2026-11-12"]);
    expect(dias[0]).toMatchObject({ sleepSeconds: 25200, hrvLastNight: 62, hrvStatus: "BALANCED" });
    // Dia com sono mas sem HRV, e dia com HRV mas sem sono: ambos ficam.
    expect(dias[1]).toMatchObject({ sleepSeconds: 18000, hrvLastNight: null });
    expect(dias[2]).toMatchObject({ sleepSeconds: null, hrvLastNight: 41 });
  });

  it("trata o 204 como 'não há medição', não como avaria", async () => {
    // Relógio na mesa de cabeceira, férias. Não é falha nenhuma.
    vi.stubGlobal("fetch", responder({
      "personal-api-key/token": { corpo: TOKEN },
      "dailySleepSummariesByDate": { estado: 204 },
      "hrv-service": { estado: 204 },
    }));
    const r = await fetchGarminDays("k", new Date("2026-11-10"), new Date("2026-11-12"));
    expect(r).toEqual({ ok: true, data: [] });
  });

  it("não tenta ler nada se a chave não servir", async () => {
    vi.stubGlobal("fetch", responder({ "personal-api-key/token": { estado: 403 } }));
    expect((await fetchGarminDays("k", new Date(), new Date())).ok).toBe(false);
  });
});

describe("garminWellnessSummary", () => {
  const dia = (over: Partial<GarminDayData>): GarminDayData => ({
    date: "2026-11-10", sleepSeconds: null, deepSleepSeconds: null, remSleepSeconds: null,
    awakeSeconds: null, hrvLastNight: null, hrvWeeklyAvg: null, hrvStatus: null, ...over,
  });

  it("não diz nada quando não há medição nenhuma", () => {
    expect(garminWellnessSummary([])).toBe("");
    expect(garminWellnessSummary([dia({})])).toBe("");
  });

  it("escreve as horas de sono em horas, não em segundos", () => {
    const t = garminWellnessSummary([dia({ sleepSeconds: 25200, deepSleepSeconds: 4800 })]);
    expect(t).toContain("dormiu 7h00");
    expect(t).toContain("profundo 1h20");
    expect(t).not.toContain("25200");
  });

  it("traduz o veredicto da Garmin sobre o HRV", () => {
    expect(garminWellnessSummary([dia({ hrvLastNight: 41, hrvStatus: "LOW" })])).toContain("HRV 41ms (baixo)");
    expect(garminWellnessSummary([dia({ hrvLastNight: 62, hrvStatus: "BALANCED" })])).toContain("(equilibrado)");
  });

  it("diz quantos dias não têm medição, para não serem lidos como maus", () => {
    const t = garminWellnessSummary([dia({ sleepSeconds: 25200 }), dia({ date: "2026-11-11" })]);
    expect(t).toContain("1 dia(s) sem medição");
  });

  it("deixa claro que isto é medição e não opinião", () => {
    const t = garminWellnessSummary([dia({ sleepSeconds: 18000 })]);
    expect(t).toContain("medição, não opinião");
  });
});
