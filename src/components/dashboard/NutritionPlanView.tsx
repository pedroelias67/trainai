"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface NutritionContent {
  summary: string;
  calories: { restDay: number; trainingDay: number; longRunDay: number; raceWeek: number };
  macros: {
    restDay: { carbsG: number; proteinG: number; fatG: number };
    trainingDay: { carbsG: number; proteinG: number; fatG: number };
    longRunDay: { carbsG: number; proteinG: number; fatG: number };
    raceWeek: { carbsG: number; proteinG: number; fatG: number };
  };
  mealPlan: {
    restDay: { meal: string; time: string; description: string; kcal: number }[];
    trainingDay: { meal: string; time: string; description: string; kcal: number }[];
  };
  duringTraining: { under60min: string; "60to90min": string; over90min: string };
  hydration: { daily: string; training: string; race: string };
  phases: { phase: string; focus: string; nutritionTip: string }[];
  foods: { recommended: string[]; avoid: string[] };
  supplements: { name: string; dose: string; timing: string; reason: string }[];
  coachNote: string;
}

interface Props {
  existingPlan: { id: string; content: any; createdAt: string } | null;
  hasBodyData: boolean;
  eventName: string | null;
}

const dayLabels: Record<string, string> = {
  restDay: "Dia de descanso",
  trainingDay: "Dia de treino",
  longRunDay: "Treino longo",
  raceWeek: "Semana da prova",
};

const macroColors = {
  carbsG: "bg-yellow-500",
  proteinG: "bg-blue-500",
  fatG: "bg-orange-500",
};

export default function NutritionPlanView({ existingPlan, hasBodyData, eventName }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeDay, setActiveDay] = useState<"restDay" | "trainingDay">("trainingDay");
  const [activeTab, setActiveTab] = useState<"meals" | "phases" | "foods" | "supplements">("meals");

  const plan: NutritionContent | null = existingPlan?.content ?? null;

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/nutrition-plan/global", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao gerar plano");
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (!plan) {
    return (
      <div className="card text-center py-12 space-y-4">
        <span className="text-5xl">🥗</span>
        <div>
          <h2 className="text-[var(--text-primary)] font-semibold text-lg">Sem plano nutricional</h2>
          <p className="text-[var(--text-secondary)] text-sm mt-2 max-w-sm mx-auto">
            Gera um plano nutricional personalizado{eventName ? ` para a tua preparação para ${eventName}` : ""}, baseado no teu perfil e plano de treino.
          </p>
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button onClick={generate} disabled={loading || !hasBodyData}
          className="btn-primary px-8 py-3 disabled:opacity-50">
          {loading ? "A gerar plano…" : "Gerar plano nutricional"}
        </button>
        {!hasBodyData && <p className="text-xs text-[var(--text-muted)]">Preenche o peso e altura no perfil primeiro.</p>}
      </div>
    );
  }

  const calEntries = Object.entries(plan.calories) as [keyof typeof plan.calories, number][];

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="card border-green-500/20 bg-green-500/3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🥗</span>
            <div>
              <h2 className="font-semibold text-[var(--text-primary)]">Plano Nutricional</h2>
              <p className="text-[var(--text-secondary)] text-sm mt-1 leading-relaxed">{plan.summary}</p>
            </div>
          </div>
          <button onClick={generate} disabled={loading}
            className="shrink-0 text-xs px-3 py-1.5 rounded-xl border border-[var(--border-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all disabled:opacity-50">
            {loading ? "A gerar…" : "↺ Regenerar"}
          </button>
        </div>
        {plan.coachNote && (
          <div className="mt-4 p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/15 flex gap-3">
            <span className="shrink-0">💡</span>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{plan.coachNote}</p>
          </div>
        )}
      </div>

      {/* Calories overview */}
      <div className="card">
        <h3 className="font-semibold text-[var(--text-primary)] mb-4">Calorias por tipo de dia</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {calEntries.map(([key, kcal]) => (
            <div key={key} className="bg-[var(--bg-subtle)] rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-[var(--text-primary)]">{kcal.toLocaleString()}</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">kcal</p>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">{dayLabels[key]}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Macros + Meals */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-[var(--text-primary)]">Macronutrientes e refeições</h3>
          <div className="flex gap-1">
            {(["restDay", "trainingDay"] as const).map((d) => (
              <button key={d} onClick={() => setActiveDay(d)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                  activeDay === d
                    ? "border-[var(--accent)] bg-green-500/10 text-green-400"
                    : "border-[var(--border-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}>
                {d === "restDay" ? "Descanso" : "Treino"}
              </button>
            ))}
          </div>
        </div>

        {/* Macros bar */}
        {plan.macros[activeDay] && (() => {
          const m = plan.macros[activeDay];
          const total = m.carbsG * 4 + m.proteinG * 4 + m.fatG * 9;
          return (
            <div className="space-y-2 mb-5">
              {([["carbsG", "Hidratos", m.carbsG * 4], ["proteinG", "Proteína", m.proteinG * 4], ["fatG", "Gordura", m.fatG * 9]] as [keyof typeof macroColors, string, number][]).map(([key, label, kcal]) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-xs text-[var(--text-muted)] w-16">{label}</span>
                  <div className="flex-1 bg-[var(--bg-hover)] rounded-full h-2">
                    <div className={`h-2 rounded-full ${macroColors[key]}`} style={{ width: `${(kcal / total) * 100}%` }} />
                  </div>
                  <span className="text-xs font-medium text-[var(--text-secondary)] w-16 text-right">
                    {key === "carbsG" ? m.carbsG : key === "proteinG" ? m.proteinG : m.fatG}g
                  </span>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Meals */}
        <div className="space-y-3">
          {plan.mealPlan[activeDay]?.map((meal, i) => (
            <div key={i} className="flex gap-3 py-2.5 border-b border-[var(--border)] last:border-0">
              <div className="shrink-0 text-center w-12">
                <p className="text-xs font-medium text-[var(--accent)]">{meal.time}</p>
                <p className="text-xs text-[var(--text-faint)]">{meal.kcal} kcal</p>
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">{meal.meal}</p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5 leading-relaxed">{meal.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs: during training / hydration / phases / foods / supplements */}
      <div className="card">
        <div className="flex gap-1 mb-4 flex-wrap">
          {([
            ["meals", "Durante treino"],
            ["phases", "Fases"],
            ["foods", "Alimentos"],
            ["supplements", "Suplementos"],
          ] as const).map(([tab, label]) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                activeTab === tab
                  ? "border-[var(--accent)] bg-green-500/10 text-green-400"
                  : "border-[var(--border-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}>
              {label}
            </button>
          ))}
        </div>

        {activeTab === "meals" && (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-[var(--text-primary)] mb-2">Hidratação</p>
              <div className="space-y-2 text-sm text-[var(--text-secondary)]">
                <p><span className="text-[var(--text-muted)]">Diária: </span>{plan.hydration.daily}</p>
                <p><span className="text-[var(--text-muted)]">Treino: </span>{plan.hydration.training}</p>
                <p><span className="text-[var(--text-muted)]">Prova: </span>{plan.hydration.race}</p>
              </div>
            </div>
            <div className="border-t border-[var(--border)] pt-4">
              <p className="text-xs font-semibold text-[var(--text-primary)] mb-2">Nutrição durante o treino</p>
              <div className="space-y-2">
                {([
                  ["Menos de 60 min", plan.duringTraining.under60min],
                  ["60 a 90 min", plan.duringTraining["60to90min"]],
                  ["Mais de 90 min", plan.duringTraining.over90min],
                ] as [string, string][]).map(([label, text]) => (
                  <div key={label} className="flex gap-2">
                    <span className="text-xs text-[var(--accent)] font-medium shrink-0 mt-0.5">{label}:</span>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "phases" && (
          <div className="space-y-3">
            {plan.phases.map((p, i) => (
              <div key={i} className="p-3 rounded-xl bg-[var(--bg-subtle)] space-y-1">
                <p className="text-sm font-semibold text-[var(--text-primary)]">{p.phase}</p>
                <p className="text-xs text-[var(--text-muted)]">{p.focus}</p>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">💡 {p.nutritionTip}</p>
              </div>
            ))}
          </div>
        )}

        {activeTab === "foods" && (
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-green-400 mb-2">✅ Recomendados</p>
              <ul className="space-y-1.5">
                {plan.foods.recommended.map((f, i) => (
                  <li key={i} className="text-xs text-[var(--text-secondary)] flex gap-2">
                    <span className="text-green-400 shrink-0">•</span>{f}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-red-400 mb-2">❌ A evitar</p>
              <ul className="space-y-1.5">
                {plan.foods.avoid.map((f, i) => (
                  <li key={i} className="text-xs text-[var(--text-secondary)] flex gap-2">
                    <span className="text-red-400 shrink-0">•</span>{f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {activeTab === "supplements" && (
          <div className="space-y-3">
            {plan.supplements.map((s, i) => (
              <div key={i} className="p-3 rounded-xl bg-[var(--bg-subtle)]">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{s.name}</p>
                  <span className="text-xs text-[var(--accent)] font-medium">{s.dose}</span>
                </div>
                <p className="text-xs text-[var(--text-muted)]">⏰ {s.timing}</p>
                <p className="text-xs text-[var(--text-secondary)] mt-1">{s.reason}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-red-400 text-sm text-center">{error}</p>}
    </div>
  );
}
