"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import dynamic from "next/dynamic";

const EnrichedMap = dynamic(() => import("@/components/dashboard/EnrichedMap"), { ssr: false });

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
  trainingLoad: number | null;
  gpsTrack: any;
  hrZones: any;
  splits: any;
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
const zoneColors = ["bg-zinc-500", "bg-green-500", "bg-yellow-500", "bg-orange-500", "bg-red-500"];

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

function FeaturedActivity({ activity }: { activity: Activity }) {
  const gpsTrack = Array.isArray(activity.gpsTrack) && activity.gpsTrack.length > 0 ? activity.gpsTrack : null;
  const hrZones = activity.hrZones as Record<string, number> | null;
  const splits = Array.isArray(activity.splits) && activity.splits.length > 0 ? activity.splits : null;

  const totalZoneSeconds = hrZones
    ? Object.values(hrZones).reduce((a: number, b) => a + (b as number), 0)
    : 0;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
      {/* Header */}
      <div className="p-5">
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

        {/* Key stats */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "km", value: activity.distance ? (activity.distance / 1000).toFixed(2) : null },
            { label: "pace", value: activity.avgPace },
            { label: "FC média", value: activity.avgHR ? `${activity.avgHR}` : null },
            { label: "duração", value: activity.duration ? formatDuration(activity.duration) : null },
          ].filter((s) => s.value).map((s) => (
            <div key={s.label} className="bg-[var(--bg-subtle)] rounded-xl p-3 text-center">
              <p className="text-base font-bold text-[var(--text-primary)]">{s.value}</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Secondary stats */}
        {(activity.elevationGain || activity.calories || activity.trainingLoad) && (
          <div className="flex gap-4 mt-3 text-xs text-[var(--text-muted)]">
            {activity.elevationGain && <span>↑ {Math.round(activity.elevationGain)}m</span>}
            {activity.calories && <span>🔥 {activity.calories} kcal</span>}
            {activity.trainingLoad && <span>Carga: {Math.round(activity.trainingLoad)}</span>}
            {activity.aerobicEffect && <span>Aeróbico: {activity.aerobicEffect.toFixed(1)}</span>}
          </div>
        )}
      </div>

      {/* Map */}
      {gpsTrack && (
        <div className="border-t border-[var(--border)]">
          <div className="h-56">
            <EnrichedMap gpsTrack={gpsTrack} elevationGain={activity.elevationGain} />
          </div>
        </div>
      )}

      {/* HR Zones */}
      {hrZones && totalZoneSeconds > 0 && (
        <div className="border-t border-[var(--border)] p-5">
          <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-3">Zonas de FC</p>
          <div className="space-y-2">
            {["z1", "z2", "z3", "z4", "z5"].map((z, i) => {
              const seconds = (hrZones[z] ?? 0) as number;
              const pct = totalZoneSeconds > 0 ? Math.round((seconds / totalZoneSeconds) * 100) : 0;
              const mins = Math.floor(seconds / 60);
              if (pct === 0) return null;
              return (
                <div key={z} className="flex items-center gap-3">
                  <span className="text-xs text-[var(--text-muted)] w-12 shrink-0">Z{i + 1} · {mins}m</span>
                  <div className="flex-1 bg-[var(--bg-hover)] rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full ${zoneColors[i]}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-[var(--text-muted)] w-8 text-right">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Splits (top 5) */}
      {splits && splits.length > 0 && (
        <div className="border-t border-[var(--border)] p-5">
          <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-3">Splits</p>
          <div className="space-y-1">
            {splits.slice(0, 5).map((split: any) => (
              <div key={split.km} className="flex items-center gap-3 text-xs">
                <span className="text-[var(--text-faint)] w-8">km {split.km}</span>
                <span className="font-medium text-[var(--text-primary)]">{split.pace}</span>
                {split.hr && <span className="text-[var(--text-muted)] ml-auto">{split.hr} bpm</span>}
              </div>
            ))}
            {splits.length > 5 && (
              <p className="text-xs text-[var(--text-faint)] mt-1">+{splits.length - 5} splits</p>
            )}
          </div>
        </div>
      )}

      {/* Footer link */}
      <div className="border-t border-[var(--border)] px-5 py-3 bg-[var(--bg-subtle)]">
        <Link href={`/dashboard/activity/${activity.id}`}
          className="text-xs text-[var(--accent)] hover:underline">
          Ver análise completa →
        </Link>
      </div>
    </div>
  );
}

export default function RecentActivitiesFeed({ activities }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (activities.length === 0) return null;

  const [latest, ...rest] = activities;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-[var(--text-primary)]">Atividades Recentes</h2>
        <Link href="/dashboard/activities" className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
          Ver todas →
        </Link>
      </div>

      <FeaturedActivity activity={latest} />

      {rest.length > 0 && (
        <div className="card space-y-1">
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
                <div className="mx-1 mb-2 rounded-xl border border-[var(--border)] overflow-hidden">
                  <div className="grid grid-cols-3 gap-2 p-3">
                    {activity.distance && <div className="text-center"><p className="text-sm font-bold text-[var(--text-primary)]">{(activity.distance / 1000).toFixed(1)} km</p><p className="text-xs text-[var(--text-muted)]">distância</p></div>}
                    {activity.avgHR && <div className="text-center"><p className="text-sm font-bold text-[var(--text-primary)]">{activity.avgHR} bpm</p><p className="text-xs text-[var(--text-muted)]">FC média</p></div>}
                    {activity.duration && <div className="text-center"><p className="text-sm font-bold text-[var(--text-primary)]">{formatDuration(activity.duration)}</p><p className="text-xs text-[var(--text-muted)]">duração</p></div>}
                  </div>
                  {Array.isArray(activity.gpsTrack) && activity.gpsTrack.length > 0 && (
                    <div className="h-40 border-t border-[var(--border)]">
                      <EnrichedMap gpsTrack={activity.gpsTrack} elevationGain={activity.elevationGain} />
                    </div>
                  )}
                  <div className="p-3 border-t border-[var(--border)] bg-[var(--bg-subtle)]">
                    <Link href={`/dashboard/activity/${activity.id}`}
                      className="block text-center text-xs text-[var(--accent)] hover:underline">
                      Ver análise completa →
                    </Link>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
