"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
  session: Session;
  onClose: () => void;
};

const DAY_NAMES = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const SESSION_TYPE_LABELS: Record<string, string> = {
  EASY: "Fácil", TEMPO: "Tempo", INTERVALS: "Intervalos", LONG: "Longo",
  RECOVERY: "Recuperação", STRENGTH: "Força", BRICK: "Brick", SWIM: "Natação", RACE: "Corrida",
};
const SESSION_TYPE_COLORS: Record<string, string> = {
  EASY: "bg-green-500/10 text-green-400 border-green-500/20",
  LONG: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  TEMPO: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  INTERVALS: "bg-red-500/10 text-red-400 border-red-500/20",
  RECOVERY: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  STRENGTH: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  BRICK: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  SWIM: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  RACE: "bg-rose-500/10 text-rose-400 border-rose-500/20",
};

export function SessionEditDrawer({ session, onClose }: Props) {
  const router = useRouter();
  const [dayOfWeek, setDayOfWeek] = useState(session.dayOfWeek);
  const [plannedDistance, setPlannedDistance] = useState(session.plannedDistance?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const hasChanges =
    dayOfWeek !== session.dayOfWeek ||
    plannedDistance !== (session.plannedDistance?.toString() ?? "");

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const body: Record<string, unknown> = {};
      if (dayOfWeek !== session.dayOfWeek) body.dayOfWeek = dayOfWeek;
      if (plannedDistance !== (session.plannedDistance?.toString() ?? "")) {
        body.plannedDistance = plannedDistance ? Number(plannedDistance) : null;
      }

      const res = await fetch(`/api/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Erro ao guardar");
      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed bottom-0 left-0 right-0 z-50 md:right-0 md:top-0 md:left-auto md:bottom-0 md:w-96
        bg-[#111] border-t md:border-t-0 md:border-l border-[#2a2a2a] rounded-t-2xl md:rounded-none
        shadow-2xl flex flex-col max-h-[90vh] md:max-h-none overflow-y-auto">

        {/* Handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-8 h-1 rounded-full bg-[#333]" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-[#1a1a1a] shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs px-2 py-0.5 rounded border ${SESSION_TYPE_COLORS[session.sessionType] ?? "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"}`}>
                {SESSION_TYPE_LABELS[session.sessionType] ?? session.sessionType}
              </span>
              {session.completed && (
                <span className="text-green-400 text-xs bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded">✓ Concluído</span>
              )}
            </div>
            <h2 className="text-white font-semibold">{session.name}</h2>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors ml-4 mt-1">
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current" strokeWidth={2}>
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 px-5 py-4 space-y-6">
          {session.shortDescription && (
            <p className="text-zinc-400 text-sm leading-relaxed">{session.shortDescription}</p>
          )}
          {session.coachTip && (
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5">
              <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Dica do treinador</p>
              <p className="text-sm text-zinc-300">{session.coachTip}</p>
            </div>
          )}

          {/* Day selector */}
          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-widest font-medium block mb-3">
              Dia da semana
            </label>
            <div className="grid grid-cols-7 gap-1">
              {DAY_NAMES.map((name, i) => {
                const dow = i + 1;
                const isSelected = dayOfWeek === dow;
                return (
                  <button
                    key={dow}
                    onClick={() => setDayOfWeek(dow)}
                    className={`py-2 rounded-lg text-xs font-medium transition-all ${
                      isSelected
                        ? "bg-green-500 text-black"
                        : "bg-[#1a1a1a] text-zinc-400 hover:bg-[#222] hover:text-white border border-[#2a2a2a]"
                    }`}>
                    {name}
                  </button>
                );
              })}
            </div>
            {dayOfWeek !== session.dayOfWeek && (
              <p className="text-xs text-amber-400 mt-2">
                ⚠ Dia alterado de {DAY_NAMES[session.dayOfWeek - 1]} para {DAY_NAMES[dayOfWeek - 1]}
              </p>
            )}
          </div>

          {/* Distance */}
          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-widest font-medium block mb-2">
              Distância planeada (km)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              className="input"
              value={plannedDistance}
              onChange={(e) => setPlannedDistance(e.target.value)}
              placeholder="ex: 12.5"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[#1a1a1a] flex gap-3 shrink-0">
          <button onClick={onClose} className="btn-secondary flex-1 py-2.5">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="btn-primary flex-1 py-2.5 disabled:opacity-40 disabled:cursor-not-allowed">
            {saving ? "A guardar…" : "Guardar alterações"}
          </button>
        </div>
      </div>
    </>
  );
}
