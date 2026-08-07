"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const STEPS = [
  {
    icon: "👋",
    title: "Bem-vindo ao TrainAI",
    body: "A tua plataforma de treino personalizada com inteligência artificial. Vamos fazer uma visita rápida.",
    action: "Começar",
  },
  {
    icon: "📋",
    title: "O teu Plano de Treino",
    body: "A IA gerou um plano personalizado com base no teu perfil e evento. Consulta a página Plano para ver todas as semanas.",
    action: "Próximo",
    link: "/dashboard/plan",
    linkLabel: "Ver Plano →",
  },
  {
    icon: "✅",
    title: "Regista os teus Treinos",
    body: "Liga o Strava para sincronização automática — as atividades aparecem aqui sozinhas. Também podes marcar sessões como concluídas manualmente.",
    action: "Próximo",
  },
  {
    icon: "💚",
    title: "Check-in Diário",
    body: "Todos os dias, regista como te sentes: sono, energia, humor e stress. A IA usa estes dados para adaptar o teu plano.",
    action: "Próximo",
  },
  {
    icon: "📊",
    title: "Acompanha a tua Evolução",
    body: "O dashboard mostra a tua carga semanal, pace e progressão. A IA analisa automaticamente cada semana e adapta o plano.",
    action: "Começar a treinar!",
  },
];

export function OnboardingTour({ isNew }: { isNew: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isNew) return;
    const done = localStorage.getItem("onboarding_done");
    if (!done) setVisible(true);
  }, [isNew]);

  function next() {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
    } else {
      finish();
    }
  }

  function finish() {
    localStorage.setItem("onboarding_done", "1");
    setVisible(false);
  }

  if (!visible) return null;

  const current = STEPS[step];
  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="fixed inset-0 z-[9990] flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-[var(--bg-card)] border border-[var(--border-hover)] rounded-2xl p-6 shadow-2xl animate-page-in">
        {/* Progress bar */}
        <div className="w-full h-1 bg-[var(--bg-hover)] rounded-full mb-6 overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Content */}
        <div className="text-center mb-6">
          <div className="text-5xl mb-4">{current.icon}</div>
          <h2 className="text-lg font-bold text-white mb-2">{current.title}</h2>
          <p className="text-[var(--text-muted)] text-sm leading-relaxed">{current.body}</p>
          {current.link && (
            <button
              onClick={() => { finish(); router.push(current.link!); }}
              className="mt-3 text-green-400 hover:text-green-300 text-sm font-medium transition-colors"
            >
              {current.linkLabel}
            </button>
          )}
        </div>

        {/* Step dots */}
        <div className="flex justify-center gap-1.5 mb-5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-300 ${
                i === step ? "w-4 h-1.5 bg-green-500" : "w-1.5 h-1.5 bg-[var(--border-strong)]"
              }`}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={finish}
            className="flex-1 py-2.5 rounded-xl border border-[var(--border-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm transition-all"
          >
            Saltar
          </button>
          <button
            onClick={next}
            className="flex-1 py-2.5 rounded-xl bg-green-500 hover:bg-green-400 text-black text-sm font-bold transition-colors"
          >
            {current.action}
          </button>
        </div>
      </div>
    </div>
  );
}
