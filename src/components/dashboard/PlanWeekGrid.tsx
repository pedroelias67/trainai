"use client";

import { useState } from "react";
import Link from "next/link";
import { format, isToday, isPast } from "date-fns";
import { pt } from "date-fns/locale";
import { SessionEditDrawer } from "./SessionEditDrawer";
import { SessionActions } from "./SessionActions";

type Session = {
  id: string;
  name: string;
  sessionType: string;
  sport: string;
  date: string;
  dayOfWeek: number;
  plannedDistance: number | null;
  plannedDuration: number | null;
  completed: boolean;
  isPriority: boolean;
  cancelled: boolean;
  shortDescription: string | null;
  coachTip: string | null;
};

type Props = {
  sessions: Session[];
};

const SESSION_TYPE_LABELS: Record<string, string> = {
  EASY: "Fácil", TEMPO: "Tempo", INTERVALS: "Intervalos", LONG: "Longo",
  RECOVERY: "Recuperação", STRENGTH: "Força", BRICK: "Brick", SWIM: "Natação", RACE: "Corrida",
};
const SESSION_TYPE_COLORS: Record<string, string> = {
  EASY: "bg-green-500/10 text-green-400 border-green-500/20",
  LONG: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  TEMPO: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  INTERVALS: "bg-red-500/10 text-red-400 border-red-500/20",
  RECOVERY: "bg-zinc-500/10 text-[var(--text-secondary)] border-zinc-500/20",
  STRENGTH: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  BRICK: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  SWIM: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  RACE: "bg-rose-500/10 text-rose-400 border-rose-500/20",
};
const SPORT_ICON: Record<string, string> = {
  RUNNING: "🏃", CYCLING: "🚴", SWIMMING: "🏊",
};

export function PlanWeekGrid({ sessions }: Props) {
  const [editingSession, setEditingSession] = useState<Session | null>(null);

  return (
    <>
      <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {sessions.map((session) => {
          const sessionDate = new Date(session.date);
          const isSessionToday = isToday(sessionDate);

          return (
            <div key={session.id} className="group relative">
              {/* Priority left border indicator */}
              {session.isPriority && !session.cancelled && (
                <div className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-yellow-400 z-10" />
              )}

              {/* Main card — click to view detail */}
              <Link href={`/dashboard/session/${session.id}`}
                className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                  session.cancelled
                    ? "border-[#2a2a2a] bg-[#111] opacity-50"
                    : session.completed
                    ? "border-green-500/20 bg-green-500/5 opacity-70"
                    : session.isPriority
                    ? "border-yellow-500/30 bg-yellow-500/5 hover:border-yellow-500/50"
                    : isSessionToday
                    ? "border-green-500/30 bg-green-500/5 hover:border-green-500/50"
                    : "border-[var(--border-hover)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-subtle)]"
                }`}>
                <span className={`text-lg shrink-0 mt-0.5 ${session.cancelled ? "grayscale" : ""}`}>
                  {SPORT_ICON[session.sport] ?? "🏃"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[var(--text-muted)] mb-0.5 capitalize">
                    {format(sessionDate, "EEE d MMM", { locale: pt })}
                    {isSessionToday && !session.cancelled && <span className="text-green-400 ml-1">· Hoje</span>}
                  </p>
                  <p className={`text-sm font-medium truncate ${session.cancelled ? "line-through text-[var(--text-muted)]" : "text-white"}`}>
                    {session.name}
                  </p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {session.cancelled ? (
                      <span className="text-xs px-1.5 py-0.5 rounded border bg-zinc-500/10 text-[var(--text-muted)] border-zinc-500/20">
                        Cancelado
                      </span>
                    ) : (
                      <>
                        <span className={`text-xs px-1.5 py-0.5 rounded border ${SESSION_TYPE_COLORS[session.sessionType] ?? "bg-zinc-500/10 text-[var(--text-secondary)] border-zinc-500/20"}`}>
                          {SESSION_TYPE_LABELS[session.sessionType]}
                        </span>
                        {session.plannedDistance && (
                          <span className="text-xs text-[var(--text-faint)]">{session.plannedDistance}km</span>
                        )}
                        {session.isPriority && (
                          <span className="text-xs text-yellow-400">⭐</span>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {session.completed && !session.cancelled && <span className="text-green-400 text-xs shrink-0">✓</span>}
              </Link>

              {/* Actions row — visible on hover for non-completed sessions */}
              {!session.completed && (
                <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <SessionActions
                    sessionId={session.id}
                    sessionDate={session.date}
                    isPriority={session.isPriority}
                    cancelled={session.cancelled}
                  />
                  <button
                    onClick={(e) => { e.preventDefault(); setEditingSession(session); }}
                    title="Editar sessão"
                    className="w-6 h-6 rounded-md bg-[var(--bg-hover)] border border-[var(--border-hover)] flex items-center justify-center
                      text-[var(--text-muted)] hover:text-white hover:border-[var(--border-strong)] transition-all">
                    <svg viewBox="0 0 24 24" className="w-3 h-3 fill-none stroke-current" strokeWidth={2}>
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {editingSession && (
        <SessionEditDrawer
          session={editingSession}
          onClose={() => setEditingSession(null)}
        />
      )}
    </>
  );
}
