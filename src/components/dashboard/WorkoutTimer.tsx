"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { haptic } from "@/components/PWAProvider";
import { buildPhases } from "@/lib/workout-phases";

function fmt(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function WorkoutTimer({
  sessionType,
  plannedDuration,
  sessionName,
  warmup = null,
  mainSet = null,
  cooldown = null,
}: {
  sessionType: string;
  plannedDuration: number | null;
  sessionName: string;
  warmup?: string | null;
  mainSet?: string | null;
  cooldown?: string | null;
}) {
  const phases = buildPhases(sessionType, plannedDuration, { warmup, mainSet, cooldown });
  const [active, setActive] = useState(false);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0); // seconds in current phase
  const [totalElapsed, setTotalElapsed] = useState(0);
  const [done, setDone] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentPhase = phases[phaseIdx];
  const remaining = currentPhase.duration > 0 ? Math.max(currentPhase.duration - elapsed, 0) : elapsed;
  const phasePct = currentPhase.duration > 0 ? Math.min(elapsed / currentPhase.duration, 1) : 0;

  const advancePhase = useCallback(() => {
    if (phaseIdx < phases.length - 1) {
      haptic("medium");
      setPhaseIdx(i => i + 1);
      setElapsed(0);
    } else {
      haptic("heavy");
      setActive(false);
      setDone(true);
    }
  }, [phaseIdx, phases.length]);

  useEffect(() => {
    if (!active) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setElapsed(e => {
        const next = e + 1;
        if (currentPhase.duration > 0 && next >= currentPhase.duration) {
          advancePhase();
          return 0;
        }
        return next;
      });
      setTotalElapsed(t => t + 1);
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [active, currentPhase.duration, advancePhase]);

  const circumference = 2 * Math.PI * 44;

  if (done) {
    return (
      <div className="card text-center py-8 border-green-500/20 bg-green-500/5">
        <div className="text-4xl mb-3">🎉</div>
        <h3 className="text-lg font-bold text-white mb-1">Treino Concluído!</h3>
        <p className="text-[var(--text-muted)] text-sm">Tempo total: {fmt(totalElapsed)}</p>
        <p className="text-[var(--text-faint)] text-xs mt-2">Não te esqueças de registar no Strava</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="font-semibold text-white mb-4">Temporizador</h2>

      {/* Phase list — segments track duration, and labels are dropped once an
          interval set makes them too narrow to read */}
      <div className="flex gap-1 mb-5">
        {phases.map((p, i) => (
          <div
            key={i}
            className="flex flex-col items-center gap-1 min-w-0"
            style={{ flexGrow: Math.max(p.duration, 1), flexBasis: 0 }}
          >
            <div
              className={`h-1.5 w-full rounded-full transition-all duration-300 ${
                i < phaseIdx ? "opacity-40" : i === phaseIdx ? "opacity-100" : "opacity-20"
              }`}
              style={{ backgroundColor: p.color }}
            />
            {phases.length <= 4 && (
              <span className={`text-[10px] truncate ${i === phaseIdx ? "text-white" : "text-[var(--text-faint)]"}`}>
                {p.label}
              </span>
            )}
          </div>
        ))}
      </div>
      {phases.length > 4 && (
        <p className="text-[10px] text-[var(--text-faint)] text-center -mt-3 mb-4">
          Fase {phaseIdx + 1} de {phases.length}
        </p>
      )}

      {/* Circular timer */}
      <div className="flex flex-col items-center gap-4 py-2">
        <div className="relative w-32 h-32">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="44" fill="none" stroke="var(--bg-hover)" strokeWidth="6" />
            <circle
              cx="50" cy="50" r="44" fill="none"
              stroke={currentPhase.color}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - phasePct)}
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-white font-mono tabular-nums">
              {currentPhase.duration > 0 ? fmt(remaining) : fmt(elapsed)}
            </span>
            <span className="text-[10px] text-[var(--text-faint)] mt-0.5">
              {currentPhase.duration > 0 ? "restante" : "decorrido"}
            </span>
          </div>
        </div>

        <div className="text-center">
          <p className="font-semibold text-white">{currentPhase.label}</p>
          <p className="text-xs text-[var(--text-muted)]">Total: {fmt(totalElapsed)}</p>
        </div>

        {/* Controls */}
        <div className="flex gap-3">
          <button
            onClick={() => { haptic("light"); setActive(a => !a); }}
            className="w-14 h-14 rounded-full flex items-center justify-center text-black font-bold text-lg transition-all active:scale-95"
            style={{ backgroundColor: currentPhase.color }}
          >
            {active ? "⏸" : "▶"}
          </button>
          {active && phaseIdx < phases.length - 1 && (
            <button
              onClick={advancePhase}
              className="w-14 h-14 rounded-full border border-[var(--border-hover)] bg-[var(--bg-hover)] flex items-center justify-center text-[var(--text-muted)] hover:text-white text-lg transition-all active:scale-95"
              title="Próxima fase"
            >
              ⏭
            </button>
          )}
          {(active || totalElapsed > 0) && (
            <button
              onClick={() => { haptic("light"); setActive(false); setElapsed(0); setTotalElapsed(0); setPhaseIdx(0); setDone(false); }}
              className="w-14 h-14 rounded-full border border-[var(--border-hover)] bg-[var(--bg-hover)] flex items-center justify-center text-[var(--text-muted)] hover:text-white transition-all active:scale-95"
              title="Reiniciar"
            >
              ↺
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
