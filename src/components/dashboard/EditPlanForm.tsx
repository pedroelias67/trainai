"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// 1=Segunda ... 6=Sábado, 7=Domingo
const DAYS_OF_WEEK = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

const FITNESS_LEVELS = [
  { value: "BEGINNER", label: "Iniciante" },
  { value: "INTERMEDIATE", label: "Intermédio" },
  { value: "ADVANCED", label: "Avançado" },
  { value: "ELITE", label: "Elite" },
];

interface Props {
  initialDays: number;
  initialLongRunDay: number;
  initialWeeklyHours: number;
  initialFitnessLevel: string;
  eventId: string;
  eventName: string;
  hasPlan: boolean;
}

export function EditPlanForm({
  initialDays, initialLongRunDay, initialWeeklyHours, initialFitnessLevel,
  eventId, eventName, hasPlan,
}: Props) {
  const router = useRouter();
  const [days, setDays] = useState(initialDays);
  const [longRunDay, setLongRunDay] = useState(initialLongRunDay);
  const [weeklyHours, setWeeklyHours] = useState(initialWeeklyHours);
  const [fitnessLevel, setFitnessLevel] = useState(initialFitnessLevel);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!eventId) { setError("Sem evento ativo para regenerar o plano."); return; }
    setLoading(true);
    setError("");

    try {
      // 1. Save preferences to athlete profile
      const profileRes = await fetch("/api/athletes/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trainingDaysPerWeek: days, longRunDay, weeklyHours, fitnessLevel }),
      });
      if (!profileRes.ok) {
        const errData = await profileRes.json().catch(() => ({}));
        throw new Error(errData.error ?? "Erro ao guardar preferências");
      }

      // 2. Archive existing plan if any
      if (hasPlan) {
        await fetch("/api/training-plans/archive", { method: "POST" });
      }

      // 3. Generate new plan
      const planRes = await fetch("/api/training-plans/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      if (!planRes.ok) throw new Error("Erro ao gerar plano");

      router.push("/dashboard/plan");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm">{error}</div>
      )}

      {eventName && (
        <div className="card flex items-center gap-3">
          <div className="w-8 h-8 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center justify-center text-sm">🎯</div>
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-widest">Evento alvo</p>
            <p className="text-white font-medium text-sm">{eventName}</p>
          </div>
        </div>
      )}

      {/* Training days per week */}
      <div className="card">
        <label className="label">
          Dias de treino por semana —{" "}
          <span className="text-green-400 normal-case font-semibold">{days} dias</span>
        </label>
        <div className="flex items-center gap-3 mt-3">
          {[3, 4, 5, 6, 7].map((d) => (
            <button key={d} type="button"
              onClick={() => setDays(d)}
              className={`flex-1 py-3 rounded-xl text-sm font-medium border transition-all ${
                days === d
                  ? "bg-green-500 text-black border-green-500"
                  : "bg-[#1a1a1a] text-zinc-400 border-[#2a2a2a] hover:border-[#3a3a3a]"
              }`}>
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Long run day */}
      <div className="card">
        <label className="label">Dia do treino longo</label>
        <div className="grid grid-cols-7 gap-1.5 mt-3">
          {DAYS_OF_WEEK.map((day, i) => {
            const val = i + 1; // 1=Seg ... 7=Dom
            return (
              <button key={val} type="button"
                onClick={() => setLongRunDay(val)}
                className={`py-3 rounded-xl text-xs font-medium border transition-all ${
                  longRunDay === val
                    ? "bg-green-500 text-black border-green-500"
                    : "bg-[#1a1a1a] text-zinc-400 border-[#2a2a2a] hover:border-[#3a3a3a]"
                }`}>
                {day.slice(0, 3)}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-zinc-600 mt-2">
          O treino longo ficará sempre agendado para {DAYS_OF_WEEK[(longRunDay - 1) % 7]}
        </p>
      </div>

      {/* Weekly hours */}
      <div className="card">
        <label className="label">
          Horas disponíveis por semana —{" "}
          <span className="text-green-400 normal-case font-semibold">{weeklyHours}h</span>
        </label>
        <input type="range" min="3" max="20" value={weeklyHours}
          onChange={(e) => setWeeklyHours(Number(e.target.value))}
          className="w-full accent-green-500 mt-3" />
        <div className="flex justify-between text-xs text-zinc-600 mt-1">
          <span>3h</span><span>20h</span>
        </div>
      </div>

      {/* Fitness level */}
      <div className="card">
        <label className="label">Nível de condição física</label>
        <div className="grid grid-cols-2 gap-2 mt-3">
          {FITNESS_LEVELS.map((level) => (
            <button key={level.value} type="button"
              onClick={() => setFitnessLevel(level.value)}
              className={`py-3 px-4 rounded-xl text-sm font-medium border text-left transition-all ${
                fitnessLevel === level.value
                  ? "bg-green-500/10 text-green-400 border-green-500/30"
                  : "bg-[#1a1a1a] text-zinc-400 border-[#2a2a2a] hover:border-[#3a3a3a]"
              }`}>
              {level.label}
            </button>
          ))}
        </div>
      </div>

      {/* Warning */}
      {hasPlan && (
        <div className="flex gap-3 p-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5">
          <span className="text-yellow-400 text-lg shrink-0">⚠️</span>
          <p className="text-sm text-yellow-300/80">
            O plano atual será substituído por um novo plano gerado com as preferências atualizadas. As atividades registadas não serão afetadas.
          </p>
        </div>
      )}

      <button type="submit" disabled={loading || !eventId} className="btn-primary w-full py-4 text-base">
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70" />
            </svg>
            A regenerar plano com IA… pode demorar 30s
          </span>
        ) : hasPlan ? "Regenerar plano →" : "Gerar plano →"}
      </button>
    </form>
  );
}
