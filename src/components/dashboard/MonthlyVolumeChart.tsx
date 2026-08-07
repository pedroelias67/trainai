"use client";

import { useMemo } from "react";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { pt } from "date-fns/locale";

type Activity = { date: string; sport: string; distance: number | null };

const SPORT_COLORS: Record<string, string> = {
  RUNNING: "#22c55e", CYCLING: "#3b82f6", SWIMMING: "#06b6d4",
};
const SPORT_LABELS: Record<string, string> = {
  RUNNING: "Corrida", CYCLING: "Ciclismo", SWIMMING: "Natação",
};
const KNOWN_SPORTS = ["RUNNING", "CYCLING", "SWIMMING"];

export function MonthlyVolumeChart({ activities }: { activities: Activity[] }) {
  const months = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const start = startOfMonth(subMonths(new Date(), 5 - i));
      const end = endOfMonth(start);
      const label = format(start, "MMM", { locale: pt });
      const bySport: Record<string, number> = {};

      for (const a of activities) {
        if (!a.distance) continue;
        const d = new Date(a.date);
        if (d < start || d > end) continue;
        const sport = KNOWN_SPORTS.includes(a.sport) ? a.sport : "RUNNING";
        bySport[sport] = (bySport[sport] ?? 0) + a.distance / 1000;
      }

      const total = Object.values(bySport).reduce((s, v) => s + v, 0);
      return { label, bySport, total: Math.round(total * 10) / 10 };
    });
  }, [activities]);

  const maxKm = Math.max(...months.map(m => m.total), 1);
  const sports = KNOWN_SPORTS.filter(s => months.some(m => (m.bySport[s] ?? 0) > 0));

  if (sports.length === 0) return null;

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-bold text-[var(--text-primary)]">Volume Mensal por Desporto</h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">últimos 6 meses · km</p>
        </div>
        <div className="flex items-center gap-3">
          {sports.map(s => (
            <div key={s} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SPORT_COLORS[s] }} />
              <span className="text-xs text-[var(--text-muted)]">{SPORT_LABELS[s]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-end gap-3 h-36">
        {months.map((month) => (
          <div key={month.label} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full flex flex-col-reverse gap-px" style={{ height: "112px" }}>
              {sports.map(sport => {
                const km = month.bySport[sport] ?? 0;
                if (km === 0) return null;
                return (
                  <div
                    key={sport}
                    title={`${SPORT_LABELS[sport]}: ${km.toFixed(1)} km`}
                    className="w-full rounded-sm transition-all duration-500"
                    style={{
                      height: `${(km / maxKm) * 100}%`,
                      backgroundColor: SPORT_COLORS[sport],
                    }}
                  />
                );
              })}
            </div>
            <span className="text-[10px] text-[var(--text-faint)] capitalize">{month.label}</span>
            {month.total > 0 && (
              <span className="text-[10px] text-[var(--text-muted)] font-semibold">{month.total}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
