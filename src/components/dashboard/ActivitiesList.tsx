"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { pt } from "date-fns/locale";

interface Activity {
  id: string;
  sport: string;
  name: string | null;
  date: string;
  distance: number | null;
  duration: number | null;
  avgPace: string | null;
  avgHR: number | null;
  maxHR: number | null;
  elevationGain: number | null;
  calories: number | null;
  trainingLoad: number | null;
  aerobicEffect: number | null;
}

const sportLabels: Record<string, string> = {
  RUNNING: "Corrida", CYCLING: "Ciclismo", SWIMMING: "Natação",
  TRIATHLON_SPRINT: "Triatlo Sprint", TRIATHLON_OLYMPIC: "Triatlo Olímpico",
  TRIATHLON_HALF: "Half Ironman", TRIATHLON_FULL: "Ironman",
};
const sportIcon: Record<string, string> = {
  RUNNING: "🏃", CYCLING: "🚴", SWIMMING: "🏊",
  TRIATHLON_SPRINT: "🏊🚴🏃", TRIATHLON_OLYMPIC: "🏊🚴🏃",
  TRIATHLON_HALF: "🏊🚴🏃", TRIATHLON_FULL: "🏊🚴🏃",
};

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

export default function ActivitiesList({ activities }: { activities: Activity[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      {activities.map((activity) => (
        <div key={activity.id} className="rounded-2xl border border-[var(--border)] overflow-hidden">
          {/* Row */}
          <button
            onClick={() => setExpanded(expanded === activity.id ? null : activity.id)}
            className="w-full flex items-center gap-4 p-4 hover:bg-[var(--bg-card)] transition-all text-left group"
          >
            <div className="w-10 h-10 bg-[var(--bg-hover)] rounded-xl flex items-center justify-center text-lg shrink-0">
              {sportIcon[activity.sport] ?? "🏃"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-[var(--text-primary)] text-sm truncate">
                {activity.name ?? sportLabels[activity.sport]}
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5 capitalize">
                {format(new Date(activity.date), "EEEE, d 'de' MMMM yyyy", { locale: pt })}
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-5 text-right shrink-0">
              {activity.distance && (
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{(activity.distance / 1000).toFixed(1)} km</p>
                  <p className="text-xs text-[var(--text-faint)]">distância</p>
                </div>
              )}
              {activity.avgPace && (
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{activity.avgPace}</p>
                  <p className="text-xs text-[var(--text-faint)]">pace</p>
                </div>
              )}
              {activity.avgHR && (
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{activity.avgHR} bpm</p>
                  <p className="text-xs text-[var(--text-faint)]">FC média</p>
                </div>
              )}
              {activity.duration && (
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{formatDuration(activity.duration)}</p>
                  <p className="text-xs text-[var(--text-faint)]">duração</p>
                </div>
              )}
            </div>
            <svg
              className={`w-4 h-4 text-[var(--text-faint)] group-hover:text-[var(--text-secondary)] transition-all shrink-0 ml-2 ${expanded === activity.id ? "rotate-90" : ""}`}
              viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </button>

          {/* Expanded preview */}
          {expanded === activity.id && (
            <div className="border-t border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-4">
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-4">
                {[
                  { label: "Distância", value: activity.distance ? `${(activity.distance / 1000).toFixed(2)} km` : null },
                  { label: "Duração", value: activity.duration ? formatDuration(activity.duration) : null },
                  { label: "Pace", value: activity.avgPace },
                  { label: "FC média", value: activity.avgHR ? `${activity.avgHR} bpm` : null },
                  { label: "Elevação", value: activity.elevationGain ? `+${Math.round(activity.elevationGain)}m` : null },
                  { label: "Calorias", value: activity.calories ? `${activity.calories} kcal` : null },
                ].filter((s) => s.value).map((s) => (
                  <div key={s.label} className="bg-[var(--bg-card)] rounded-xl p-3 text-center border border-[var(--border)]">
                    <p className="text-sm font-bold text-[var(--text-primary)]">{s.value}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
              {(activity.trainingLoad || activity.aerobicEffect) && (
                <div className="flex gap-4 mb-4 text-xs text-[var(--text-muted)]">
                  {activity.trainingLoad && <span>Carga de treino: <strong className="text-[var(--text-secondary)]">{Math.round(activity.trainingLoad)}</strong></span>}
                  {activity.aerobicEffect && <span>Efeito aeróbico: <strong className="text-[var(--text-secondary)]">{activity.aerobicEffect.toFixed(1)}</strong></span>}
                </div>
              )}
              <Link
                href={`/dashboard/activity/${activity.id}`}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Ver análise completa, mapa e splits →
              </Link>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
