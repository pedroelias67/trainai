"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { DISTANCES, DISTANCE_LABELS, PRIORITIES, SPORTS } from "@/lib/race-options";

export type Race = {
  id: string;
  name: string;
  date: string;
  sport: string;
  distance: string;
  priority: string;
};

const PRIORITY_STYLE: Record<string, string> = {
  A: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  B: "text-sky-400 bg-sky-500/10 border-sky-500/20",
  C: "text-[var(--text-muted)] bg-[var(--surface-2)] border-[var(--border)]",
};

/**
 * The athlete's races, and a way to add one.
 *
 * Until now a race could only be entered during onboarding, so a second race —
 * the 10K on the way to the marathon — had nowhere to go, and the plan was
 * written as though the athlete's calendar were empty.
 */
export function RacesCard({ races, targetEventId }: { races: Race[]; targetEventId: string | null }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nota, setNota] = useState<string[] | null>(null);
  const [apagar, setApagar] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    sport: "RUNNING",
    distance: "TEN_K",
    date: "",
    priority: "B",
    goalType: "FINISH",
    goalTime: "",
  });

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true);
    setError(null);
    setNota(null);
    try {
      const res = await fetch("/api/athletes/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? `Erro ao guardar a prova (${res.status})`);

      // What it moved in the plan, so a missing long run is explained rather
      // than discovered.
      setNota(
        data?.plan?.changes?.length
          ? data.plan.changes
          : ["Prova guardada. O plano não tinha nada a mudar nesta semana."]
      );
      setForm({ ...form, name: "", date: "", goalTime: "" });
      setAberto(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setWorking(false);
    }
  }

  async function remover(id: string) {
    setWorking(true);
    setError(null);
    setNota(null);
    try {
      const res = await fetch(`/api/athletes/events/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? `Erro ao apagar (${res.status})`);
      setNota(
        data?.removedSessions > 0
          ? ["Prova apagada e retirada do plano e do relógio."]
          : ["Prova apagada."]
      );
      setApagar(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setWorking(false);
    }
  }

  const distancias = DISTANCES[form.sport] ?? DISTANCES.RUNNING;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-[var(--text-primary)]">Provas</h2>
        <button
          onClick={() => { setAberto(!aberto); setError(null); setNota(null); }}
          className="text-xs px-3 py-1.5 rounded-lg border border-[var(--border-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-all"
        >
          {aberto ? "Cancelar" : "+ Adicionar prova"}
        </button>
      </div>

      {races.length === 0 && !aberto && (
        <p className="text-[var(--text-muted)] text-sm">
          Ainda não tens provas no calendário.
        </p>
      )}

      {races.length > 0 && (
        <div className="space-y-3 mb-4">
          {races.map(race => {
            const alvo = race.id === targetEventId;
            return (
              <div key={race.id} className="flex items-center justify-between gap-3 py-2.5 border-b border-[var(--border)] last:border-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[var(--text-primary)] text-sm font-medium truncate">{race.name}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${PRIORITY_STYLE[race.priority] ?? PRIORITY_STYLE.C}`}>
                      {race.priority}
                    </span>
                    {alvo && (
                      <span className="text-green-400 text-[10px] bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded-full">
                        Plano ativo
                      </span>
                    )}
                  </div>
                  <p className="text-[var(--text-muted)] text-xs capitalize">
                    {format(new Date(race.date), "d 'de' MMMM yyyy", { locale: pt })}
                    {DISTANCE_LABELS[race.distance] ? ` · ${DISTANCE_LABELS[race.distance]}` : ""}
                  </p>
                </div>

                {!alvo && (
                  apagar === race.id ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => remover(race.id)}
                        disabled={working}
                        className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                      >
                        {working ? "A apagar…" : "Confirmar"}
                      </button>
                      <button onClick={() => setApagar(null)} className="text-xs text-[var(--text-muted)]">
                        Não
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setApagar(race.id)}
                      className="text-xs text-[var(--text-muted)] hover:text-red-400 shrink-0 transition-colors"
                    >
                      Apagar
                    </button>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}

      {nota && (
        <div className="mb-4 p-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] space-y-1">
          {nota.map((linha, i) => (
            <p key={i} className="text-xs text-[var(--text-secondary)]">{linha}</p>
          ))}
        </div>
      )}

      {error && (
        <p className="mb-4 text-xs text-red-400">{error}</p>
      )}

      {aberto && (
        <form onSubmit={adicionar} className="space-y-4 pt-2 border-t border-[var(--border)]">
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1.5">Nome da prova</label>
            <input
              required minLength={2} maxLength={120}
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="ex: São Silvestre de Coimbra"
              className="w-full px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-primary)] text-sm focus:border-[var(--border-strong)] outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1.5">Modalidade</label>
              <select
                value={form.sport}
                onChange={e => {
                  const sport = e.target.value;
                  setForm({ ...form, sport, distance: (DISTANCES[sport] ?? DISTANCES.RUNNING)[0].value });
                }}
                className="w-full px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-primary)] text-sm outline-none"
              >
                {SPORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1.5">Distância</label>
              <select
                value={form.distance}
                onChange={e => setForm({ ...form, distance: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-primary)] text-sm outline-none"
              >
                {distancias.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1.5">Data</label>
            <input
              type="date" required
              value={form.date}
              onChange={e => setForm({ ...form, date: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-primary)] text-sm outline-none"
            />
          </div>

          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-2">Que peso tem esta prova?</label>
            <div className="space-y-2">
              {PRIORITIES.map(p => (
                <label
                  key={p.value}
                  className={`block p-2.5 rounded-lg border cursor-pointer transition-all ${
                    form.priority === p.value
                      ? "border-[var(--border-strong)] bg-[var(--surface-2)]"
                      : "border-[var(--border)] hover:border-[var(--border-hover)]"
                  }`}
                >
                  <input
                    type="radio" name="priority" value={p.value}
                    checked={form.priority === p.value}
                    onChange={() => setForm({ ...form, priority: p.value })}
                    className="sr-only"
                  />
                  <span className="block text-sm text-[var(--text-primary)]">{p.label}</span>
                  <span className="block text-xs text-[var(--text-muted)] mt-0.5">{p.help}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={working}
            className="w-full py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium disabled:opacity-50 transition-opacity"
          >
            {working ? "A guardar…" : "Guardar prova"}
          </button>

          <p className="text-[11px] text-[var(--text-muted)]">
            A prova entra no plano que tens em curso, sem o refazer: aparece no dia certo e os
            treinos à volta dela dão-lhe lugar.
          </p>
        </form>
      )}
    </div>
  );
}
