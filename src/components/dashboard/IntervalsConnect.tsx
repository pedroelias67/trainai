"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function IntervalsConnect({ connected }: { connected: boolean }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/intervals/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao ligar");
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
    await fetch("/api/intervals/connect", { method: "DELETE" });
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="border-t border-[var(--border)] pt-4 mt-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 text-sm">
            📅
          </div>
          <div className="min-w-0">
            <p className="text-[var(--text-primary)] text-sm font-medium">Intervals.icu</p>
            <p className="text-[var(--text-muted)] text-xs">
              {connected
                ? "Ligado · envia treinos para o relógio"
                : "Envia os treinos planeados para Garmin, COROS, Suunto ou Wahoo"}
            </p>
          </div>
        </div>
        {connected ? (
          <button onClick={disconnect} disabled={loading}
            className="text-xs text-[var(--text-muted)] hover:text-red-400 transition-colors shrink-0 disabled:opacity-50">
            Desligar
          </button>
        ) : (
          <button onClick={() => setShowForm(v => !v)}
            className="btn-primary text-xs py-2 shrink-0">
            {showForm ? "Cancelar" : "Ligar"}
          </button>
        )}
      </div>

      {showForm && !connected && (
        <form onSubmit={connect} className="mt-4 space-y-3">
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            O Intervals.icu é um serviço gratuito que entrega os treinos ao teu relógio — a Garmin, a COROS
            e as outras não os aceitam vindos diretamente daqui. Configura-se uma vez:
          </p>
          <ol className="text-xs text-[var(--text-secondary)] space-y-2">
            {[
              "Cria uma conta gratuita em intervals.icu.",
              "Liga lá o relógio: ícone do perfil → Settings → Integrations → escolhe a tua marca → Connect. Inicia sessão com a mesma conta do relógio.",
              "Ainda em Settings, desce até ao fundo, a Developer Settings, e copia a API key.",
              "Cola-a aqui em baixo.",
            ].map((text, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="shrink-0 w-5 h-5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] font-bold flex items-center justify-center mt-px">
                  {i + 1}
                </span>
                <span className="leading-relaxed">{text}</span>
              </li>
            ))}
          </ol>
          <p className="text-xs text-[var(--text-faint)] leading-relaxed">
            Feito isto, cada semana do Plano ganha um botão para enviar os treinos. A chave fica guardada
            e podes desligar quando quiseres.
          </p>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="API key do Intervals.icu"
            autoComplete="off"
            className="w-full bg-[var(--bg-hover)] border border-[var(--border-hover)] rounded-xl px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button type="submit" disabled={loading || !apiKey.trim()}
            className="btn-primary text-xs py-2 w-full disabled:opacity-50">
            {loading ? "A verificar…" : "Ligar Intervals.icu"}
          </button>
        </form>
      )}
    </div>
  );
}
