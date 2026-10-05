import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { replaceEvents, buildCalendarEvent } from "@/lib/intervals-icu";

// The calendar is meant to mirror the week. It used to delete only the events
// it was about to write again, so anything that left the week — a session the
// athlete cancelled, a long run a race displaced — stayed on the watch for
// good, and the athlete woke up on race day with two workouts asking to be run.

const CALENDARIO = [
  { id: 101, external_id: "trainai-s1", start_date_local: "2026-10-01T00:00:00", category: "WORKOUT" },
  { id: 102, external_id: "trainai-s2", start_date_local: "2026-10-04T00:00:00", category: "WORKOUT" },
  // O longo que a prova substituiu: cancelado na app, vivo no calendário.
  { id: 103, external_id: "trainai-cancelada", start_date_local: "2026-10-04T00:00:00", category: "WORKOUT" },
  // Do próprio atleta: não é nosso e não se toca.
  { id: 104, external_id: null, start_date_local: "2026-10-02T00:00:00", category: "WORKOUT" },
];

let apagados: number[] = [];
let criados: unknown[] = [];

beforeEach(() => {
  apagados = [];
  criados = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "DELETE") {
      apagados.push(Number(url.split("/").pop()));
      return { ok: true, json: async () => ({}) };
    }
    if (init?.method === "POST") {
      criados.push(JSON.parse(String(init.body)));
      return { ok: true, json: async () => criados[criados.length - 1] };
    }
    return { ok: true, json: async () => CALENDARIO };
  }));
});
afterEach(() => vi.unstubAllGlobals());

const sessao = (id: string, date: string, name: string) =>
  buildCalendarEvent({
    id, name, sport: "RUNNING", sessionType: "EASY", date: new Date(date),
    plannedDuration: 40, plannedPace: null,
    warmup: null, mainSet: null, cooldown: null, steps: null,
  } as never);

describe("replaceEvents", () => {
  it("limpa tudo o que é nosso na janela, não só o que vai reescrever", async () => {
    await replaceEvents("k", "i1", [sessao("s1", "2026-10-01T00:00:00Z", "Fácil")], {
      from: "2026-09-28", to: "2026-10-04",
    });

    // Os três nossos saem, incluindo o da sessão que já não existe.
    expect(apagados.sort()).toEqual([101, 102, 103]);
    // O do atleta fica.
    expect(apagados).not.toContain(104);
  });

  it("limpa a janela mesmo quando não há nada para enviar", async () => {
    // Uma semana cujas sessões foram todas canceladas tem de sair do relógio.
    const r = await replaceEvents("k", "i1", [], { from: "2026-09-28", to: "2026-10-04" });
    expect(apagados.sort()).toEqual([101, 102, 103]);
    expect(criados).toEqual([]);
    expect(r).toEqual({ ok: true, count: 0 });
  });

  it("sem janela nem eventos, não faz nada", async () => {
    const r = await replaceEvents("k", "i1", []);
    expect(apagados).toEqual([]);
    expect(r).toEqual({ ok: true, count: 0 });
  });

  it("volta a criar o que lhe foi dado", async () => {
    await replaceEvents(
      "k", "i1",
      [sessao("s1", "2026-10-01T00:00:00Z", "Fácil"), sessao("s9", "2026-10-04T00:00:00Z", "Longo")],
      { from: "2026-09-28", to: "2026-10-04" }
    );
    expect(criados).toHaveLength(1);
    const lote = criados[0] as Array<{ external_id: string }>;
    expect(lote.map(e => e.external_id)).toEqual(["trainai-s1", "trainai-s9"]);
  });
});
