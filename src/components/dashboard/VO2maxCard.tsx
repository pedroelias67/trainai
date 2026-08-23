import { format } from "date-fns";
import { pt } from "date-fns/locale";
import type { VO2maxEstimate } from "@/lib/vo2max";

export function VO2maxCard({
  estimate,
  rating,
}: {
  estimate: VO2maxEstimate | null;
  rating: string | null;
}) {
  if (!estimate) {
    return (
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
        <h3 className="font-bold text-[var(--text-primary)]">VO2max estimado</h3>
        <p className="text-sm text-[var(--text-secondary)] mt-2 leading-relaxed">
          Ainda não há um esforço que sirva de base. Corre uma distância entre 3km e meia maratona
          a ritmo forte — de prova ou de treino — e a estimativa aparece aqui depois de sincronizar.
        </p>
        <p className="text-xs text-[var(--text-faint)] mt-3">
          Preferimos não mostrar nada a mostrar um número inventado.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-bold text-[var(--text-primary)]">VO2max estimado</h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">fórmula VDOT de Jack Daniels</p>
        </div>
        {rating && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full text-green-400 bg-green-500/10 border border-green-500/20 shrink-0">
            {rating}
          </span>
        )}
      </div>

      <div className="flex items-baseline gap-2 mb-4">
        <span className="text-4xl font-bold text-white tabular-nums">{estimate.value}</span>
        <span className="text-sm text-[var(--text-muted)]">ml/kg/min</span>
      </div>

      <div className="rounded-xl bg-[var(--bg-subtle)] p-3 space-y-1">
        <p className="text-xs text-[var(--text-secondary)]">
          Calculado a partir de <strong className="text-[var(--text-primary)]">{estimate.source}</strong>
          {" · "}
          {format(estimate.date, "d 'de' MMMM", { locale: pt })}
        </p>
        {estimate.confidence === "média" && (
          <p className="text-xs text-yellow-400/80">
            Esse esforço tem mais de 3 meses — reflete a forma que tinhas então, não necessariamente a de agora.
          </p>
        )}
      </div>

      <p className="text-[10px] text-[var(--text-faint)] mt-3 leading-relaxed">
        Estimativa a partir do teu melhor esforço dos últimos 12 meses, não uma medição laboratorial.
        Sobe quando corres mais rápido a mesma distância.
      </p>
    </div>
  );
}
