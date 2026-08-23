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
          Ainda não há dados que cheguem. Com a FC máxima e de repouso preenchidas no perfil,
          bastam três corridas com frequência cardíaca registada.
        </p>
        <p className="text-xs text-[var(--text-faint)] mt-3">
          Preferimos não mostrar nada a mostrar um número inventado.
        </p>
      </div>
    );
  }

  const byHeartRate = estimate.method === "heart-rate-reserve";

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-bold text-[var(--text-primary)]">VO2max estimado</h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {byHeartRate ? "por pace e frequência cardíaca" : "fórmula VDOT de Jack Daniels"}
          </p>
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
        {!byHeartRate && estimate.confidence === "média" && (
          <p className="text-xs text-yellow-400/80">
            Esse esforço tem mais de 3 meses — reflete a forma que tinhas então, não necessariamente a de agora.
          </p>
        )}
        {byHeartRate && estimate.confidence === "média" && (
          <p className="text-xs text-yellow-400/80">
            Poucos treinos com FC no período — o valor estabiliza à medida que sincronizas mais.
          </p>
        )}
      </div>

      <p className="text-[10px] text-[var(--text-faint)] mt-3 leading-relaxed">
        {byHeartRate
          ? "Depende da FC máxima e de repouso do teu perfil estarem certas — se estiverem erradas, o valor arrasta o erro. É o mesmo princípio que o teu relógio usa, por isso os números devem aproximar-se."
          : "Vem de um esforço próximo do máximo, que é quando esta fórmula é exata. Não é uma medição laboratorial."}
      </p>
    </div>
  );
}
