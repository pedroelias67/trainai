"use client";

import { useMemo } from "react";
import { format, subWeeks, startOfWeek, endOfWeek } from "date-fns";
import { pt } from "date-fns/locale";

type Activity = {
  id: string;
  date: string;
  distance: number | null;
  duration: number | null;
  avgPace: string | null;
  sport: string;
};

type WeeklyLoad = {
  label: string;
  km: number;
  minutes: number;
  isCurrent: boolean;
};

function paceToSeconds(pace: string): number {
  const [m, s] = pace.split(":").map(Number);
  return m * 60 + (s || 0);
}

function secondsToPace(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function WeeklyLoadChart({ activities }: { activities: Activity[] }) {
  const weeks: WeeklyLoad[] = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 8 }, (_, i) => {
      const weekStart = startOfWeek(subWeeks(now, 7 - i), { weekStartsOn: 1 });
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      const weekActivities = activities.filter(a => {
        const d = new Date(a.date);
        return d >= weekStart && d <= weekEnd;
      });
      const km = weekActivities.reduce((s, a) => s + (a.distance ? a.distance / 1000 : 0), 0);
      const minutes = weekActivities.reduce((s, a) => s + (a.duration ? a.duration / 60 : 0), 0);
      return {
        label: format(weekStart, "d MMM", { locale: pt }),
        km: Math.round(km * 10) / 10,
        minutes: Math.round(minutes),
        isCurrent: i === 7,
      };
    });
  }, [activities]);

  const maxKm = Math.max(...weeks.map(w => w.km), 1);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-[var(--text-primary)]">Carga Semanal</h2>
        <span className="text-xs text-[var(--text-muted)]">últimas 8 semanas · km</span>
      </div>
      <div className="flex items-end gap-1.5 h-28">
        {weeks.map((week, i) => {
          const heightPct = maxKm > 0 ? (week.km / maxKm) * 100 : 0;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
              {/* Tooltip */}
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-[var(--bg-hover)] border border-[var(--border-hover)] rounded-lg px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                <p className="text-xs text-white font-semibold">{week.km} km</p>
                <p className="text-xs text-[var(--text-muted)]">{week.minutes} min</p>
              </div>
              <div className="w-full flex items-end justify-center" style={{ height: "88px" }}>
                <div
                  className={`w-full rounded-t-lg transition-all duration-500 ${
                    week.isCurrent ? "bg-green-500" : "bg-[var(--bg-hover)] group-hover:bg-[var(--border-strong)]"
                  }`}
                  style={{ height: `${Math.max(heightPct, week.km > 0 ? 4 : 0)}%` }}
                />
              </div>
              <span className={`text-[10px] ${week.isCurrent ? "text-green-400 font-medium" : "text-[var(--text-faint)]"}`}>
                {week.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PaceEvolutionChart({ activities }: { activities: Activity[] }) {
  const runningWithPace = useMemo(() =>
    activities
      .filter(a => a.sport === "RUNNING" && a.avgPace && a.distance && a.distance > 3000)
      .slice(0, 12)
      .reverse(),
    [activities]
  );

  if (runningWithPace.length < 2) return null;

  const paces = runningWithPace.map(a => paceToSeconds(a.avgPace!));
  const minPace = Math.min(...paces);
  const maxPace = Math.max(...paces);
  const range = maxPace - minPace || 60;

  const W = 100;
  const H = 60;
  const points = paces.map((p, i) => {
    // Invert: faster pace (lower seconds) = higher on chart
    const x = (i / (paces.length - 1)) * W;
    const y = H - ((maxPace - p) / range) * (H - 8) - 4;
    return { x, y, pace: p, activity: runningWithPace[i] };
  });

  const polyline = points.map(p => `${p.x},${p.y}`).join(" ");
  const areaPath = `M${points[0].x},${H} ${points.map(p => `L${p.x},${p.y}`).join(" ")} L${points[points.length - 1].x},${H} Z`;

  const trend = paces[paces.length - 1] - paces[0];
  const trendLabel = trend < -10 ? "↑ A melhorar" : trend > 10 ? "↓ A desacelerar" : "→ Estável";
  const trendColor = trend < -10 ? "text-green-400" : trend > 10 ? "text-red-400" : "text-[var(--text-muted)]";

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-[var(--text-primary)]">Evolução de Pace</h2>
        <span className={`text-xs font-medium ${trendColor}`}>{trendLabel}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-24" preserveAspectRatio="none">
        <defs>
          <linearGradient id="paceGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#paceGrad)" />
        <polyline points={polyline} fill="none" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="1.5" fill="#22c55e" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-[var(--text-faint)]">
          {format(new Date(runningWithPace[0].date), "d MMM", { locale: pt })}
        </span>
        <span className="text-xs text-white font-semibold">
          {secondsToPace(paces[paces.length - 1])}/km
        </span>
        <span className="text-[10px] text-[var(--text-faint)]">
          {format(new Date(runningWithPace[runningWithPace.length - 1].date), "d MMM", { locale: pt })}
        </span>
      </div>
    </div>
  );
}
