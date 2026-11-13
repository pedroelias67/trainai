"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * The athlete's own Garmin data, through a personal API key.
 *
 * Separate from the Strava card above it, which brings in what they ran, and
 * from Intervals.icu below, which sends workouts out. This one is the only
 * route to what the watch measured overnight — sleep and heart-rate
 * variability — and it feeds the Sunday adaptation, which until now had only
 * what the athlete typed in by hand.
 */
export function GarminConnect({
  connected,
  lastSyncAt,
  syncError,
}: {
  connected: boolean;
  lastSyncAt: string | null;
  syncError: string | null;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nota, setNota] = useState<string | null>(null);

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/garmin/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? `Erro ao ligar (${res.status})`);
      setNota(data?.message ?? "Ligado.");
      setApiKey("");
      setShowForm(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  async function disconnect() {
    setLoading(true);
    await fetch("/api/garmin/connect", { method: "DELETE" });
    setNota(null);
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="border-t border-[var(--border)] pt-4 mt-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0 text-sm">
            😴
          </div>
          <div className="min-w-0">
            <p className="text-[var(--text-primary)] text-sm font-medium">Garmin — sono e HRV</p>
            <p className="text-[var(--text-muted)] text-xs">
              {connected
                ? syncError
                  ? `Ligado, mas a última leitura falhou`
                  : lastSyncAt
                  ? `Ligado · última leitura ${new Date(lastSyncAt).toLocaleDateString("pt-PT")}`
                  : "Ligado"
                : "Deixa a análise semanal usar o que o relógio mediu"}
            </p>
          </div>
        </div>
        {connected ? (
          <button onClick={disconnect} disabled={loading}
            className="text-xs text-[var(--text-muted)] hover:text-red-400 transition-colors shrink-0 disabled:opacity-50">
            Desligar
          </button>
        ) : (
          <button onClick={() => setShowForm(v => !v)} className="btn-primary text-xs py-2 shrink-0">
            {showForm ? "Cancelar" : "Ligar"}
          </button>
        )}
      </div>

      {showForm && !connected && (
        <form onSubmit={connect} className="mt-4 space-y-3">
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            A análise de domingo usa hoje o que escreves à mão no registo de bem-estar. Com isto,
            passa a usar as horas de sono e o HRV que o teu relógio mediu. É uma chave tua, só de
            leitura, e só dá acesso aos teus próprios dados.
          </p>
          <ol className="text-xs text-[var(--text-secondary)] space-y-2">
            {[
              ["Abre o Garmin Connect no browser", "Definições → Chave de API pessoal."],
              ["Cria a chave", "Aceita os termos, escolhe a validade e carrega em Criar."],
              ["Copia-a nesse momento", "A Garmin só a mostra uma vez — trata-a como uma palavra-passe."],
              ["Cola-a aqui em baixo", "Verificamos logo se funciona e trazemos as últimas duas semanas."],
            ].map(([titulo, detalhe], i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="shrink-0 w-5 h-5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-[10px] font-bold flex items-center justify-center mt-px">
                  {i + 1}
                </span>
                <span className="leading-relaxed">
                  <strong className="font-medium text-[var(--text-primary)]">{titulo}.</strong> {detalhe}
                </span>
              </li>
            ))}
          </ol>
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="Chave de API pessoal da Garmin"
            autoComplete="off"
            className="w-full bg-[var(--bg-hover)] border border-[var(--border-hover)] rounded-xl px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button type="submit" disabled={loading || !apiKey.trim()}
            className="btn-primary text-xs py-2 w-full disabled:opacity-50">
            {loading ? "A verificar…" : "Ligar Garmin"}
          </button>
          <p className="text-[11px] text-[var(--text-faint)] leading-relaxed">
            Isto não envia treinos para o relógio — essa parte continua a ser o Intervals.icu. A
            Garmin só permite enviar treinos a quem tenha acesso empresarial.
          </p>
        </form>
      )}

      {nota && <p className="mt-3 text-xs text-green-400">{nota}</p>}
      {connected && syncError && (
        <p className="mt-3 text-xs text-yellow-400">{syncError}</p>
      )}
    </div>
  );
}
