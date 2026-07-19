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
  calories: number | null;
  elevationGain: number | null;
  aerobicEffect: number | null;
}

interface Props {
  activities: Activity[];
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

function FeaturedActivity({ activity }: { activity: Activity }) {
  return (
    <Link href={`/dashboard/activity/${activity.id}`}
      className="block group">
      <div className="rounded-2xl border border-[var(--border)] hover:border-[var(--accent)]/40 bg-[var(--bg-card)] hover:bg-green-500/3 transition-all p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{sportIcon[activity.sport] ?? "🏃"}</span>
            <div>
              <p className="font-semibold text-[var(--text-primary)] text-base leading-tight">
                {activity.name ?? sportLabels[activity.sport]}
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5 capitalize">
                {format(new Date(activity.date), "EEEE, d 'de' MMMM", { locale: pt })}
              </p>
            </div>
          </div>
          <span className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full shrink-0">
            Último treino
          </span>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {activity.distance && (
            <div className="bg-[var(--bg-subtle)] rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-[var(--text-primary)]">{(activity.distance / 1000).toFixed(2)}</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">km</p>
            </div>
          )}
          {activity.avgPace && (
            <div className="bg-[var(--bg-subtle)] rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-[var(--text-primary)]">{activity.avgPace}</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">pace</p>
            </div>
          )}
          {activity.avgHR && (
            <div className="bg-[var(--bg-subtle)] rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-[var(--text-primary)]">{activity.avgHR}</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">bpm FC</p>
            </div>
          )}
          {activity.duration && (
            <div className="bg-[var(--bg-subtle)] rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-[var(--text-primary)]">{formatDuration(activity.duration)}</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">duração</p>
            </div>
          )}
        </div>

        {(activity.elevationGain || activity.calories || activity.aerobicEffect) && (
          <div className="flex gap-4 mt-3 pt-3 border-t border-[var(--border)]">
            {activity.elevationGain && (
              <span className="text-xs text-[var(--text-muted)]">↑ {Math.round(activity.elevationGain)}m</span>
            )}
            {activity.calories && (
              <span className="text-xs text-[var(--text-muted)]">🔥 {activity.calories} kcal</span>
            )}
            {activity.aerobicEffect && (
              <span className="text-xs text-[var(--text-muted)]">Efeito aeróbico: {activity.aerobicEffect.toFixed(1)}</span>
            )}
          </div>
        )}

        <p className="text-xs text-[var(--accent)] mt-3 group-hover:underline">
          Ver análise completa e mapa →
        </p>
      </div>
    </Link>
  );
}

export default function RecentActivitiesFeed({ activities }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (activities.length === 0) return null;

  const [latest, ...rest] = activities;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-[var(--text-primary)]">Atividades Recentes</h2>
        <Link href="/dashboard/activities" className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
          Ver todas →
        </Link>
      </div>

      <FeaturedActivity activity={latest} />

      {rest.length > 0 && (
        <div className="mt-3 space-y-1">
          {rest.map((activity) => (
            <div key={activity.id}>
              <button
                onClick={() => setExpanded(expanded === activity.id ? null : activity.id)}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--bg-subtle)] transition-colors text-left group"
              >
                <span className="text-base">{sportIcon[activity.sport] ?? "🏃"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                    {activity.name ?? sportLabels[activity.sport]}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {format(new Date(activity.date), "d MMM", { locale: pt })}
                    {activity.distance ? ` · ${(activity.distance / 1000).toFixed(1)}km` : ""}
                    {activity.avgPace ? ` · ${activity.avgPace}` : ""}
                  </p>
                </div>
                <svg
                  className={`w-4 h-4 text-[var(--text-faint)] transition-transform shrink-0 ${expanded === activity.id ? "rotate-90" : ""}`}
                  viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </button>

              {expanded === activity.id && (
                <div className="mx-3 mb-2 p-3 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border)]">
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {activity.distance && (
                      <div className="text-center">
                        <p className="text-sm font-bold text-[var(--text-primary)]">{(activity.distance / 1000).toFixed(1)} km</p>
                        <p className="text-xs text-[var(--text-muted)]">distância</p>
                      </div>
                    )}
                    {activity.avgHR && (
                      <div className="text-center">
                        <p className="text-sm font-bold text-[var(--text-primary)]">{activity.avgHR} bpm</p>
                        <p className="text-xs text-[var(--text-muted)]">FC média</p>
                      </div>
                    )}
                    {activity.duration && (
                      <div className="text-center">
                        <p className="text-sm font-bold text-[var(--text-primary)]">{formatDuration(activity.duration)}</p>
                        <p className="text-xs text-[var(--text-muted)]">duração</p>
                      </div>
                    )}
                  </div>
                  <Link href={`/dashboard/activity/${activity.id}`}
                    className="block text-center text-xs text-[var(--accent)] hover:underline">
                    Ver análise completa e mapa →
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
