"use client";
import { useState, useEffect } from "react";

interface Props {
  sessionId: string;
}

export default function NutritionPlan({ sessionId }: Props) {
  const [plan, setPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const cached = localStorage.getItem(`nutrition_${sessionId}`);
    if (cached) setPlan(cached);
  }, [sessionId]);

  const generatePlan = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/nutrition-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (data.plan) {
        setPlan(data.plan);
        localStorage.setItem(`nutrition_${sessionId}`, data.plan);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-green-500/20 bg-[#0f1a0f] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">🥗</span>
          <h2 className="font-semibold text-white">Nutrição e Hidratação</h2>
        </div>
        {!plan && (
          <button
            onClick={generatePlan}
            disabled={loading}
            className="px-3 py-1.5 bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black text-xs font-semibold rounded-lg transition-colors"
          >
            {loading ? "A gerar…" : "Gerar plano"}
          </button>
        )}
        {plan && (
          <button
            onClick={() => { setPlan(null); localStorage.removeItem(`nutrition_${sessionId}`); }}
            className="text-xs text-[var(--text-faint)] hover:text-[var(--text-secondary)] transition-colors"
          >
            Regenerar
          </button>
        )}
      </div>

      {!plan && !loading && (
        <p className="text-sm text-[var(--text-faint)]">
          Gera um plano personalizado de nutrição e hidratação para este treino.
        </p>
      )}

      {loading && (
        <div className="flex items-center gap-2 py-4">
          <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[var(--text-muted)]">A criar o teu plano…</p>
        </div>
      )}

      {plan && (
        <div className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">
          {plan}
        </div>
      )}
    </div>
  );
}
