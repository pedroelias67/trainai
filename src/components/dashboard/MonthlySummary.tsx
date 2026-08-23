"use client";

import { useState } from "react";
import { formatPace, formatHours, type MonthStat } from "@/lib/monthly-stats";

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function Change({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-[var(--text-faint)]">—</span>;
  if (pct === 0) return <span className="text-[var(--text-muted)]">=</span>;
  const up = pct > 0;
  return (
    <span className={up ? "text-green-400" : "text-orange-400"}>
      {up ? "▲" : "▼"} {Math.abs(pct)}%
    </span>
  );
}

export function MonthlySummary({ months }: { months: MonthStat[] }) {
  const [expanded, setExpanded] = useState(false);

  const withTraining = months.filter(m => m.activities > 0);
  if (withTraining.length === 0) return null;

  // Newest first — the month you care about should not be at the bottom.
  const ordered = [...months].reverse();
  const visible = expanded ? ordered : ordered.slice(0, 6);

  const totalKm = months.reduce((s, m) => s + m.km, 0);
  const totalSeconds = months.reduce((s, m) => s + m.seconds, 0);
  const totalActivities = months.reduce((s, m) => s + m.activities, 0);
  const bestMonth = withTraining.reduce((a, b) => (b.km > a.km ? b : a));

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
      <div className="mb-5">
        <h3 className="font-bold text-[var(--text-primary)]">Resumo Mensal</h3>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">
          últimos {months.length} meses · variação face ao mês anterior
        </p>
      </div>

      {/* Totals across the whole window */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
        {[
          { label: "km totais", value: Math.round(totalKm).toLocaleString("pt-PT") },
          { label: "tempo", value: formatHours(totalSeconds) },
          { label: "treinos", value: String(totalActivities) },
          { label: "melhor mês", value: `${Math.round(bestMonth.km)} km` },
        ].map(s => (
          <div key={s.label} className="bg-[var(--bg-subtle)] rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-[var(--text-primary)]">{s.value}</p>
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5 uppercase tracking-wide">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Per-month breakdown */}
      <div className="overflow-x-auto -mx-5 px-5">
        <table className="w-full text-sm min-w-[380px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-[var(--text-faint)] border-b border-[var(--border)]">
              <th className="text-left font-medium pb-2">Mês</th>
              <th className="text-right font-medium pb-2">km</th>
              <th className="text-right font-medium pb-2">Tempo</th>
              <th className="text-right font-medium pb-2">Treinos</th>
              <th className="text-right font-medium pb-2 hidden sm:table-cell">Pace</th>
              <th className="text-right font-medium pb-2 hidden sm:table-cell">Desnível</th>
              <th className="text-right font-medium pb-2">vs. ant.</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((m, i) => {
              const isCurrent = i === 0;
              return (
                <tr
                  key={m.key}
                  className={`border-b border-[var(--border)] last:border-0 ${
                    m.activities === 0 ? "opacity-40" : ""
                  }`}
                >
                  <td className="py-2.5 text-left">
                    <span className={isCurrent ? "text-green-400 font-medium" : "text-[var(--text-secondary)]"}>
                      {MONTH_NAMES[m.month - 1]} {String(m.year).slice(2)}
                    </span>
                  </td>
                  <td className="py-2.5 text-right font-semibold text-[var(--text-primary)] tabular-nums">
                    {m.km > 0 ? m.km.toFixed(1) : "—"}
                  </td>
                  <td className="py-2.5 text-right text-[var(--text-secondary)] tabular-nums">
                    {m.seconds > 0 ? formatHours(m.seconds) : "—"}
                  </td>
                  <td className="py-2.5 text-right text-[var(--text-secondary)] tabular-nums">
                    {m.activities || "—"}
                  </td>
                  <td className="py-2.5 text-right text-[var(--text-secondary)] tabular-nums hidden sm:table-cell">
                    {formatPace(m.paceSecPerKm) ?? "—"}
                  </td>
                  <td className="py-2.5 text-right text-[var(--text-secondary)] tabular-nums hidden sm:table-cell">
                    {m.elevation > 0 ? `${m.elevation.toLocaleString("pt-PT")}m` : "—"}
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-xs">
                    <Change pct={m.kmChangePct} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {ordered.length > 6 && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="w-full mt-3 py-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          {expanded ? "Mostrar menos" : `Ver os ${ordered.length} meses`}
        </button>
      )}

      <p className="text-[10px] text-[var(--text-faint)] mt-3">
        O pace é calculado a partir do total de corrida do mês, não da média dos treinos.
      </p>
    </div>
  );
}
