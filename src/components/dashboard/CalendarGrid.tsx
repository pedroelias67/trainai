"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format, isSameDay, isSameMonth } from "date-fns";

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

const SESSION_TYPE_LABELS: Record<string, string> = {
  EASY: "Fácil", TEMPO: "Tempo", INTERVALS: "Intervalos", LONG: "Longo",
  RECOVERY: "Recuperação", STRENGTH: "Força", BRICK: "Brick", SWIM: "Natação", RACE: "Corrida",
};

const SPORT_ICON: Record<string, string> = {
  RUNNING: "🏃", CYCLING: "🚴", SWIMMING: "🏊",
  TRIATHLON_SPRINT: "🏊🚴🏃", TRIATHLON_OLYMPIC: "🏊🚴🏃",
  TRIATHLON_HALF: "🏊🚴🏃", TRIATHLON_FULL: "🏊🚴🏃",
};

type Session = {
  id: string;
  date: string;
  sport: string;
  sessionType: string;
  name: string;
  completed: boolean;
  isPriority: boolean;
  cancelled: boolean;
};

type Activity = {
  id: string;
  date: string;
  sport: string;
  name: string | null;
};

type Props = {
  days: string[]; // ISO date strings
  sessions: Session[];
  activities: Activity[];
  currentMonth: string; // ISO date string for the 1st of current month
};

export default function CalendarGrid({ days, sessions, activities, currentMonth }: Props) {
  const router = useRouter();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  // Mobile: tap-to-move mode
  const [selectedForMove, setSelectedForMove] = useState<string | null>(null);
  const dragRef = useRef<string | null>(null);

  const today = new Date();
  const currentMonthDate = new Date(currentMonth);

  async function moveSession(sessionId: string, newDate: Date) {
    setMoving(true);
    const jsDay = newDate.getDay(); // 0=Sun
    const dayOfWeek = jsDay === 0 ? 7 : jsDay;
    try {
      await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: newDate.toISOString(), dayOfWeek }),
      });
      router.refresh();
    } finally {
      setMoving(false);
      setDraggingId(null);
      setDragOverDay(null);
      setSelectedForMove(null);
      dragRef.current = null;
    }
  }

  function handleDragStart(e: React.DragEvent, sessionId: string) {
    dragRef.current = sessionId;
    setDraggingId(sessionId);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent, dayIso: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverDay(dayIso);
  }

  function handleDrop(e: React.DragEvent, day: Date) {
    e.preventDefault();
    const id = dragRef.current;
    if (!id) return;
    moveSession(id, day);
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDragOverDay(null);
    dragRef.current = null;
  }

  // Mobile: tap session to select, tap day to move
  function handleSessionTap(e: React.MouseEvent, sessionId: string, completed: boolean) {
    if (completed) return; // can't move completed sessions
    // If already selected, deselect
    if (selectedForMove === sessionId) {
      e.preventDefault();
      setSelectedForMove(null);
      return;
    }
    // Select for move — only activate if long-press would be needed;
    // here we use a dedicated move button approach via a small icon
  }

  return (
    <div className={`grid grid-cols-7 gap-1 ${moving ? "opacity-60 pointer-events-none" : ""}`}>
      {days.map((dayIso) => {
        const day = new Date(dayIso);
        const isCurrentMonth = isSameMonth(day, currentMonthDate);
        const isToday = isSameDay(day, today);
        const daySessions = sessions.filter((s) => isSameDay(new Date(s.date), day));
        const dayActivities = activities.filter((a) => isSameDay(new Date(a.date), day));
        const hasActivityWithoutSession = dayActivities.length > 0 && daySessions.length === 0;
        const isDragTarget = dragOverDay === dayIso && draggingId !== null;
        const isMoveTarget = selectedForMove !== null;

        return (
          <div
            key={dayIso}
            onDragOver={(e) => handleDragOver(e, dayIso)}
            onDragLeave={() => setDragOverDay(null)}
            onDrop={(e) => handleDrop(e, day)}
            onClick={() => {
              if (selectedForMove && isCurrentMonth) {
                moveSession(selectedForMove, day);
              }
            }}
            className={`min-h-[100px] p-2 rounded-xl border transition-all ${
              isDragTarget
                ? "border-[var(--accent)] bg-green-500/10 scale-[1.02]"
                : isMoveTarget && isCurrentMonth
                ? "border-[var(--border-hover)] bg-[var(--bg-hover)] cursor-pointer hover:border-[var(--accent)] hover:bg-green-500/5"
                : isToday
                ? "border-green-500 bg-green-500/5"
                : isCurrentMonth
                ? "border-[var(--border)] bg-[var(--bg-card)]"
                : "border-[#181818] bg-[#0d0d0d] opacity-40"
            }`}
          >
            <p className={`text-xs font-medium mb-1 ${
              isToday ? "text-green-400" : isCurrentMonth ? "text-[var(--text-secondary)]" : "text-[var(--text-faint)]"
            }`}>
              {format(day, "d")}
              {isMoveTarget && isCurrentMonth && (
                <span className="ml-1 text-[var(--accent)] text-[10px]">↓</span>
              )}
            </p>

            <div className="space-y-1">
              {daySessions.map((session) => {
                const isDragging = draggingId === session.id;
                const isSelected = selectedForMove === session.id;

                return (
                  <div key={session.id} className="relative group/chip">
                    <Link
                      href={`/dashboard/session/${session.id}`}
                      draggable={!session.completed}
                      onDragStart={(e) => {
                        if (session.completed) { e.preventDefault(); return; }
                        handleDragStart(e, session.id);
                      }}
                      onDragEnd={handleDragEnd}
                      onClick={(e) => {
                        if (selectedForMove === session.id) {
                          e.preventDefault();
                          setSelectedForMove(null);
                        } else if (selectedForMove) {
                          e.preventDefault(); // don't navigate, let day handler move
                        }
                      }}
                      className={`block text-xs px-1.5 py-1 rounded border truncate transition-all select-none ${
                        isDragging ? "opacity-40 scale-95" : "hover:opacity-80"
                      } ${isSelected ? "ring-2 ring-[var(--accent)] ring-offset-1 ring-offset-[var(--bg-base)]" : ""} ${
                        session.cancelled ? "opacity-40 line-through" : ""
                      } ${SESSION_TYPE_COLORS[session.sessionType] ?? "bg-zinc-500/10 text-[var(--text-secondary)] border-zinc-500/20"}`}
                    >
                      <span className="mr-1">{SPORT_ICON[session.sport] ?? "🏃"}</span>
                      {session.completed && <span className="text-green-400 mr-1">✓</span>}
                      {session.isPriority && <span className="mr-0.5">⭐</span>}
                      {SESSION_TYPE_LABELS[session.sessionType] ?? session.name}
                    </Link>

                    {/* Move button for mobile / alternative to drag */}
                    {!session.completed && !session.cancelled && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setSelectedForMove(selectedForMove === session.id ? null : session.id);
                        }}
                        title={selectedForMove === session.id ? "Cancelar mover" : "Mover para outro dia"}
                        className={`absolute -top-1 -right-1 w-4 h-4 rounded-full text-[8px] flex items-center justify-center
                          opacity-0 group-hover/chip:opacity-100 transition-opacity z-10
                          ${selectedForMove === session.id
                            ? "bg-[var(--accent)] text-black opacity-100"
                            : "bg-[var(--bg-hover)] border border-[var(--border-hover)] text-[var(--text-muted)]"
                          }`}
                      >
                        ↕
                      </button>
                    )}
                  </div>
                );
              })}

              {hasActivityWithoutSession && (
                <div className="text-xs px-1.5 py-1 rounded border bg-zinc-800/30 text-[var(--text-muted)] border-zinc-700/30 truncate">
                  {SPORT_ICON[dayActivities[0].sport] ?? "🏃"} {dayActivities[0].name ?? "Atividade"}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Mobile instructions */}
      {selectedForMove && (
        <div className="col-span-7 mt-2 text-center text-xs text-[var(--accent)] animate-pulse">
          Toca no dia para onde queres mover o treino · <button onClick={() => setSelectedForMove(null)} className="underline">Cancelar</button>
        </div>
      )}
    </div>
  );
}
