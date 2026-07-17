"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface QuestionnaireData {
  activityLevel: string;
  dietStyle: string;
  foodAllergies: string;
  mealsPerDay: number;
  mainSport: string;
  trainingTimeOfDay: string;
  bodyFatPct: string;
}

const STEPS = [
  {
    id: "activityLevel",
    title: "Nível de atividade diária",
    subtitle: "Fora dos treinos, como é o teu dia-a-dia?",
    type: "choice" as const,
    options: [
      { value: "sedentary", label: "Sedentário", desc: "Trabalho de escritório, pouco movimento" },
      { value: "lightly_active", label: "Ligeiramente ativo", desc: "Alguns passeios, trabalho de pé ocasional" },
      { value: "active", label: "Ativo", desc: "Trabalho físico ou muito movimento diário" },
      { value: "very_active", label: "Muito ativo", desc: "Trabalho físico intenso ou duplas sessões" },
    ],
  },
  {
    id: "trainingTimeOfDay",
    title: "Quando treinas habitualmente?",
    subtitle: "O timing das refeições adapta-se ao horário dos treinos",
    type: "choice" as const,
    options: [
      { value: "early_morning", label: "Manhã cedo", desc: "Antes das 8h" },
      { value: "morning", label: "Manhã", desc: "Entre as 8h e as 12h" },
      { value: "afternoon", label: "Tarde", desc: "Entre as 12h e as 18h" },
      { value: "evening", label: "Noite", desc: "Após as 18h" },
    ],
  },
  {
    id: "dietStyle",
    title: "Estilo alimentar",
    subtitle: "Como defines a tua alimentação habitual?",
    type: "choice" as const,
    options: [
      { value: "omnivore", label: "Omnívoro", desc: "Como de tudo" },
      { value: "mediterranean", label: "Mediterrânico", desc: "Peixe, legumes, azeite, pouca carne vermelha" },
      { value: "vegetarian", label: "Vegetariano", desc: "Sem carne nem peixe" },
      { value: "vegan", label: "Vegan", desc: "Sem produtos de origem animal" },
      { value: "low_carb", label: "Low-carb", desc: "Reduzido em hidratos de carbono" },
      { value: "high_protein", label: "High-protein", desc: "Foco em proteína elevada" },
    ],
  },
  {
    id: "mealsPerDay",
    title: "Quantas refeições por dia?",
    subtitle: "O plano distribui as calorias pelo número que preferires",
    type: "choice" as const,
    options: [
      { value: "3", label: "3 refeições", desc: "Pequeno-almoço, almoço e jantar" },
      { value: "4", label: "4 refeições", desc: "Inclui um lanche" },
      { value: "5", label: "5 refeições", desc: "Inclui lanche e pós-treino" },
      { value: "6", label: "6 refeições", desc: "Refeições frequentes e menores" },
    ],
  },
  {
    id: "mainSport",
    title: "Modalidade principal",
    subtitle: "Qual o desporto com mais peso no teu treino?",
    type: "choice" as const,
    options: [
      { value: "running", label: "Corrida", desc: "" },
      { value: "cycling", label: "Ciclismo", desc: "" },
      { value: "triathlon", label: "Triatlo", desc: "" },
      { value: "swimming", label: "Natação", desc: "" },
      { value: "gym", label: "Ginásio", desc: "Musculação / cross-training" },
    ],
  },
  {
    id: "extras",
    title: "Últimos detalhes",
    subtitle: "Opcional — melhora a precisão do plano",
    type: "extras" as const,
  },
];

interface Props {
  hasSport: boolean; // se já tem plano de treino (skip sport step)
}

export default function NutritionQuestionnaire({ hasSport }: Props) {
  const router = useRouter();
  const steps = hasSport ? STEPS.filter((s) => s.id !== "mainSport") : STEPS;

  const [step, setStep] = useState(0);
  const [data, setData] = useState<QuestionnaireData>({
    activityLevel: "",
    dietStyle: "",
    foodAllergies: "",
    mealsPerDay: 4,
    mainSport: "",
    trainingTimeOfDay: "",
    bodyFatPct: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = steps[step];
  const isLast = step === steps.length - 1;

  function select(field: keyof QuestionnaireData, value: string) {
    setData((d) => ({ ...d, [field]: field === "mealsPerDay" ? Number(value) : value }));
  }

  function canAdvance() {
    if (current.type === "extras") return true;
    const val = data[current.id as keyof QuestionnaireData];
    return val !== "" && val !== 0;
  }

  async function finish() {
    setSaving(true);
    setError(null);
    try {
      const body: any = {
        activityLevel: data.activityLevel,
        dietStyle: data.dietStyle,
        foodAllergies: data.foodAllergies,
        mealsPerDay: data.mealsPerDay,
        trainingTimeOfDay: data.trainingTimeOfDay,
        bodyFatPct: data.bodyFatPct,
      };
      if (!hasSport) body.mainSport = data.mainSport;

      const res = await fetch("/api/athletes/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error("Erro ao guardar");
      router.refresh();
    } catch (e: any) {
      setError(e.message);
      setSaving(false);
    }
  }

  return (
    <div className="card max-w-lg mx-auto">
      {/* Progress */}
      <div className="flex gap-1 mb-6">
        {steps.map((_, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= step ? "bg-[var(--accent)]" : "bg-[var(--bg-hover)]"}`} />
        ))}
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">{current.title}</h2>
        <p className="text-sm text-[var(--text-muted)] mt-1">{current.subtitle}</p>
      </div>

      {current.type === "choice" && (
        <div className="space-y-2 mb-6">
          {current.options!.map((opt) => {
            const val = data[current.id as keyof QuestionnaireData];
            const selected = String(val) === opt.value;
            return (
              <button key={opt.value} onClick={() => select(current.id as keyof QuestionnaireData, opt.value)}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                  selected
                    ? "border-[var(--accent)] bg-green-500/10 text-[var(--text-primary)]"
                    : "border-[var(--border-hover)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
                }`}>
                <span className="font-medium text-sm">{opt.label}</span>
                {opt.desc && <span className="text-xs text-[var(--text-muted)] ml-2">{opt.desc}</span>}
              </button>
            );
          })}
        </div>
      )}

      {current.type === "extras" && (
        <div className="space-y-4 mb-6">
          <div>
            <label className="text-sm text-[var(--text-secondary)] block mb-1.5">Alergias ou intolerâncias alimentares</label>
            <input
              type="text"
              value={data.foodAllergies}
              onChange={(e) => setData((d) => ({ ...d, foodAllergies: e.target.value }))}
              placeholder="ex: lactose, glúten, frutos secos…"
              className="w-full px-4 py-2.5 rounded-xl border border-[var(--border-hover)] bg-[var(--bg-subtle)] text-[var(--text-primary)] text-sm placeholder-[var(--text-faint)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div>
            <label className="text-sm text-[var(--text-secondary)] block mb-1.5">
              % Gordura corporal <span className="text-[var(--text-faint)]">(opcional)</span>
            </label>
            <input
              type="number"
              min="3"
              max="50"
              step="0.5"
              value={data.bodyFatPct}
              onChange={(e) => setData((d) => ({ ...d, bodyFatPct: e.target.value }))}
              placeholder="ex: 18"
              className="w-full px-4 py-2.5 rounded-xl border border-[var(--border-hover)] bg-[var(--bg-subtle)] text-[var(--text-primary)] text-sm placeholder-[var(--text-faint)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>
      )}

      {error && <p className="text-red-400 text-xs mb-4">{error}</p>}

      <div className="flex gap-3">
        {step > 0 && (
          <button onClick={() => setStep((s) => s - 1)} className="px-4 py-2.5 rounded-xl border border-[var(--border-hover)] text-[var(--text-secondary)] text-sm hover:text-[var(--text-primary)] transition-colors">
            ← Anterior
          </button>
        )}
        <button
          onClick={isLast ? finish : () => setStep((s) => s + 1)}
          disabled={!canAdvance() || saving}
          className="flex-1 py-2.5 rounded-xl bg-[var(--accent)] text-white font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          {saving ? "A guardar…" : isLast ? "Gerar plano nutricional →" : "Continuar →"}
        </button>
      </div>
    </div>
  );
}
