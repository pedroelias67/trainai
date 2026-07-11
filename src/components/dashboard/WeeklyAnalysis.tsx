"use client";

import { useState } from "react";

interface Analysis {
  summary: string;
  adaptations: string;
  nextWeekAdjustments: string;
}

interface Props {
  weekId: string;
  weekNumber: number;
  savedAnalysis: Analysis | null;
}

export function WeeklyAnalysis({ weekId, weekNumber, savedAnalysis }: Props) {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(savedAnalysis);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(!!savedAnalysis);

  async function runAnalysis() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/training-plans/analyze-week", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekId }),
      });
      if (!res.ok) throw new Error("Erro ao analisar semana");
      const data = await res.json();
      setAnalysis(data);
      setOpen(true);
    } catch {
      setError("Não foi possível gerar a análise. Tenta novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 border-t border-[#1a1a1a] pt-4">
      {!analysis ? (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white">Análise IA da semana {weekNumber}</p>
            <p className="text-xs text-zinc-500 mt-0.5">Compara o planeado com o realizado e ajusta a semana seguinte</p>
          </div>
          <button onClick={runAnalysis} disabled={loading}
            className="btn-primary text-xs py-2 px-4 shrink-0 ml-4">
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70" />
                </svg>
                A analisar…
              </span>
            ) : "Analisar semana →"}
          </button>
        </div>
      ) : (
        <div>
          <button onClick={() => setOpen(!open)}
            className="flex items-center justify-between w-full text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">Análise IA — Semana {weekNumber}</span>
              <span className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">Concluída</span>
            </div>
            <svg className={`w-4 h-4 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>

          {open && (
            <div className="mt-4 space-y-4">
              <div className="bg-[#161616] rounded-xl p-4">
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-2">Resumo da semana</p>
                <p className="text-sm text-zinc-300 leading-relaxed">{analysis.summary}</p>
              </div>
              <div className="bg-[#161616] rounded-xl p-4">
                <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-2">Adaptação fisiológica</p>
                <p className="text-sm text-zinc-300 leading-relaxed">{analysis.adaptations}</p>
              </div>
              <div className="bg-green-500/5 border border-green-500/15 rounded-xl p-4">
                <p className="text-xs font-semibold text-green-400 uppercase tracking-widest mb-2">Ajustes para a semana seguinte</p>
                <p className="text-sm text-zinc-300 leading-relaxed">{analysis.nextWeekAdjustments}</p>
              </div>
              <button onClick={runAnalysis} disabled={loading}
                className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
                {loading ? "A reanalisar…" : "Reanalisar"}
              </button>
            </div>
          )}
        </div>
      )}
      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
    </div>
  );
}
