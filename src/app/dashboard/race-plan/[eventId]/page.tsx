"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

export default function RacePlanPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [plan, setPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const cached = localStorage.getItem(`race_plan_${eventId}`);
    if (cached) setPlan(cached);
  }, [eventId]);

  const generatePlan = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/race-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      const data = await res.json();
      if (data.plan) {
        setPlan(data.plan);
        localStorage.setItem(`race_plan_${eventId}`, data.plan);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => window.print();

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <header className="sticky top-0 z-40 border-b border-[var(--border)] backdrop-blur-xl bg-black/60 px-6 py-3 print:hidden">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <span className="text-white font-bold text-lg">TrainAI</span>
          <Link href="/dashboard" className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm transition-colors">← Dashboard</Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Estratégia de Corrida</h1>
            <p className="text-[var(--text-muted)] text-sm mt-1">Plano detalhado para o dia do evento</p>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            {plan && (
              <button
                onClick={handlePrint}
                className="px-3 py-1.5 bg-[var(--bg-hover)] hover:bg-[#252525] text-[var(--text-secondary)] text-xs font-medium rounded-lg transition-colors border border-[var(--border-hover)]"
              >
                🖨️ Imprimir / Guardar PDF
              </button>
            )}
            {plan && (
              <button
                onClick={() => { setPlan(null); localStorage.removeItem(`race_plan_${eventId}`); }}
                className="text-xs text-[var(--text-faint)] hover:text-[var(--text-secondary)] transition-colors"
              >
                Regenerar
              </button>
            )}
          </div>
        </div>

        {!plan && !loading && (
          <div className="card text-center py-12">
            <span className="text-5xl mb-4 block">🏁</span>
            <p className="text-[var(--text-secondary)] mb-6">Gera a tua estratégia personalizada para este evento com base no teu perfil e atividades recentes.</p>
            <button
              onClick={generatePlan}
              className="px-6 py-2.5 bg-green-500 hover:bg-green-400 text-black font-semibold rounded-xl transition-colors"
            >
              Gerar estratégia
            </button>
          </div>
        )}

        {loading && (
          <div className="card text-center py-12">
            <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-[var(--text-muted)]">A preparar a tua estratégia…</p>
          </div>
        )}

        {plan && (
          <div className="card">
            <div className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap print:text-black print:bg-white">
              {plan}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
