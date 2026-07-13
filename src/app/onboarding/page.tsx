"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogoFull } from "@/components/ui/Logo";

type Step = "profile" | "event" | "done";

const FITNESS_LEVELS = [
  { value: "BEGINNER", label: "Iniciante", desc: "Menos de 1 ano de treino regular" },
  { value: "INTERMEDIATE", label: "Intermédio", desc: "1–3 anos de treino regular" },
  { value: "ADVANCED", label: "Avançado", desc: "3–7 anos, competições regulares" },
  { value: "ELITE", label: "Elite", desc: "+7 anos, alto rendimento" },
];

const SPORTS = [
  { value: "RUNNING", label: "Corrida", icon: "🏃" },
  { value: "TRIATHLON_SPRINT", label: "Triatlo Sprint", icon: "⚡" },
  { value: "TRIATHLON_OLYMPIC", label: "Triatlo Olímpico", icon: "🔱" },
  { value: "TRIATHLON_HALF", label: "Half Ironman", icon: "💪" },
  { value: "TRIATHLON_FULL", label: "Ironman", icon: "🔴" },
];

const DISTANCES: Record<string, Array<{ value: string; label: string }>> = {
  RUNNING: [
    { value: "FIVE_K", label: "5km" },
    { value: "TEN_K", label: "10km" },
    { value: "HALF_MARATHON", label: "Meia Maratona" },
    { value: "MARATHON", label: "Maratona" },
    { value: "ULTRA", label: "Ultra" },
  ],
  TRIATHLON_SPRINT: [{ value: "SPRINT_TRIATHLON", label: "Triatlo Sprint" }],
  TRIATHLON_OLYMPIC: [{ value: "OLYMPIC_TRIATHLON", label: "Triatlo Olímpico" }],
  TRIATHLON_HALF: [{ value: "HALF_IRONMAN", label: "70.3 Half Ironman" }],
  TRIATHLON_FULL: [{ value: "IRONMAN", label: "140.6 Ironman" }],
};

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("profile");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [profile, setProfile] = useState({
    dateOfBirth: "",
    gender: "MALE",
    fitnessLevel: "INTERMEDIATE",
    weeklyHours: 8,
  });

  const [event, setEvent] = useState({
    name: "",
    sport: "RUNNING",
    distance: "MARATHON",
    date: "",
    goalType: "FINISH",
    goalTime: "",
  });

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/athletes/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (!res.ok) throw new Error("Erro ao guardar perfil");
      setStep("event");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  async function handleEventSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const eventRes = await fetch("/api/athletes/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event),
      });
      if (!eventRes.ok) throw new Error("Erro ao criar evento");
      const eventData = await eventRes.json();

      const planRes = await fetch("/api/training-plans/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: eventData.id }),
      });
      if (!planRes.ok) throw new Error("Erro ao gerar plano");

      setStep("done");
      setTimeout(() => router.push("/dashboard"), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  const distances = DISTANCES[event.sport] ?? DISTANCES.RUNNING;

  return (
    <div className="min-h-screen bg-[var(--bg-base)] flex flex-col items-center px-4 pt-10 pb-20">
      <div className="mb-10">
        <LogoFull size={32} />
      </div>

      <div className="w-full max-w-lg">
        {/* Steps indicator */}
        {step !== "done" && (
          <div className="flex items-center gap-3 mb-10">
            {(["profile", "event"] as const).map((s, i) => (
              <div key={s} className="flex items-center gap-3 flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  step === s
                    ? "bg-green-500 text-black"
                    : s === "profile" && step === "event"
                    ? "bg-green-500/20 text-green-400"
                    : "bg-[var(--bg-hover)] text-[var(--text-faint)]"
                }`}>
                  {s === "profile" && step === "event" ? "✓" : i + 1}
                </div>
                <span className={`text-xs font-medium ${step === s ? "text-white" : "text-[var(--text-faint)]"}`}>
                  {s === "profile" ? "Perfil" : "Evento"}
                </span>
                {i === 0 && <div className="flex-1 h-px bg-[#222] ml-1" />}
              </div>
            ))}
          </div>
        )}

        {step === "profile" && (
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">O teu perfil de atleta</h1>
            <p className="text-[var(--text-muted)] text-sm mb-8">Ajuda-nos a criar o plano certo para ti</p>

            <form onSubmit={handleProfileSubmit} className="card space-y-6">
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm">{error}</div>
              )}

              <div>
                <label className="label">Data de nascimento</label>
                <input type="date" className="input" value={profile.dateOfBirth}
                  onChange={(e) => setProfile({ ...profile, dateOfBirth: e.target.value })} required />
              </div>

              <div>
                <label className="label">Género</label>
                <select className="input" value={profile.gender}
                  onChange={(e) => setProfile({ ...profile, gender: e.target.value })}>
                  <option value="MALE">Masculino</option>
                  <option value="FEMALE">Feminino</option>
                  <option value="OTHER">Outro</option>
                </select>
              </div>

              <div>
                <label className="label">
                  Horas disponíveis por semana —{" "}
                  <span className="text-green-400 normal-case font-semibold">{profile.weeklyHours}h</span>
                </label>
                <input type="range" min="3" max="20" value={profile.weeklyHours}
                  onChange={(e) => setProfile({ ...profile, weeklyHours: Number(e.target.value) })}
                  className="w-full accent-green-500 mt-2" />
                <div className="flex justify-between text-xs text-[var(--text-faint)] mt-1">
                  <span>3h</span><span>20h</span>
                </div>
              </div>

              <div>
                <label className="label">Nível de condição física</label>
                <div className="space-y-2 mt-2">
                  {FITNESS_LEVELS.map((level) => (
                    <label key={level.value}
                      className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                        profile.fitnessLevel === level.value
                          ? "border-green-500/40 bg-green-500/5"
                          : "border-[var(--border-hover)] hover:border-[var(--border-strong)]"
                      }`}>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                        profile.fitnessLevel === level.value ? "border-green-500" : "border-[var(--border-strong)]"
                      }`}>
                        {profile.fitnessLevel === level.value && (
                          <div className="w-2 h-2 bg-green-500 rounded-full" />
                        )}
                      </div>
                      <input type="radio" name="fitnessLevel" value={level.value}
                        checked={profile.fitnessLevel === level.value}
                        onChange={() => setProfile({ ...profile, fitnessLevel: level.value })}
                        className="sr-only" />
                      <div>
                        <p className="text-sm font-medium text-white">{level.label}</p>
                        <p className="text-xs text-[var(--text-muted)]">{level.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                {loading ? "A guardar..." : "Continuar →"}
              </button>
            </form>
          </div>
        )}

        {step === "event" && (
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">O teu evento alvo</h1>
            <p className="text-[var(--text-muted)] text-sm mb-8">A IA vai criar um plano periodizado até ao evento</p>

            <form onSubmit={handleEventSubmit} className="card space-y-6">
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm">{error}</div>
              )}

              <div>
                <label className="label">Nome do evento</label>
                <input type="text" className="input" value={event.name}
                  onChange={(e) => setEvent({ ...event, name: e.target.value })}
                  placeholder="ex: Maratona do Porto 2025" required />
              </div>

              <div>
                <label className="label">Modalidade</label>
                <div className="grid grid-cols-1 gap-2 mt-2">
                  {SPORTS.map((sport) => (
                    <label key={sport.value}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        event.sport === sport.value
                          ? "border-green-500/40 bg-green-500/5"
                          : "border-[var(--border-hover)] hover:border-[var(--border-strong)]"
                      }`}>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        event.sport === sport.value ? "border-green-500" : "border-[var(--border-strong)]"
                      }`}>
                        {event.sport === sport.value && <div className="w-2 h-2 bg-green-500 rounded-full" />}
                      </div>
                      <input type="radio" name="sport" value={sport.value}
                        checked={event.sport === sport.value}
                        onChange={() => setEvent({ ...event, sport: sport.value, distance: DISTANCES[sport.value]?.[0]?.value ?? "MARATHON" })}
                        className="sr-only" />
                      <span className="text-base">{sport.icon}</span>
                      <span className="text-sm font-medium text-white">{sport.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Distância</label>
                <select className="input" value={event.distance}
                  onChange={(e) => setEvent({ ...event, distance: e.target.value })}>
                  {distances.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Data do evento</label>
                <input type="date" className="input" value={event.date}
                  min={new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]}
                  onChange={(e) => setEvent({ ...event, date: e.target.value })} required />
              </div>

              <div>
                <label className="label">Objetivo</label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {[
                    { value: "FINISH", label: "Terminar" },
                    { value: "TIME", label: "Tempo alvo" },
                    { value: "PODIUM", label: "Pódio" },
                  ].map((goal) => (
                    <label key={goal.value}
                      className={`text-center p-3 rounded-xl border cursor-pointer text-sm font-medium transition-all ${
                        event.goalType === goal.value
                          ? "border-green-500/40 bg-green-500/5 text-green-400"
                          : "border-[var(--border-hover)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"
                      }`}>
                      <input type="radio" name="goalType" value={goal.value}
                        checked={event.goalType === goal.value}
                        onChange={() => setEvent({ ...event, goalType: goal.value })}
                        className="sr-only" />
                      {goal.label}
                    </label>
                  ))}
                </div>
              </div>

              {event.goalType === "TIME" && (
                <div>
                  <label className="label">Tempo alvo (HH:MM:SS)</label>
                  <input type="text" className="input" value={event.goalTime}
                    onChange={(e) => setEvent({ ...event, goalTime: e.target.value })}
                    placeholder="ex: 3:30:00" />
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-primary w-full py-3.5">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70" />
                    </svg>
                    A gerar plano com IA… pode demorar 30s
                  </span>
                ) : "Gerar plano de treino →"}
              </button>
            </form>
          </div>
        )}

        {step === "done" && (
          <div className="card text-center py-16">
            <div className="w-16 h-16 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-6">
              🎉
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Plano criado!</h2>
            <p className="text-[var(--text-muted)] text-sm">O teu plano de treino personalizado está pronto. A redirecionar…</p>
            <div className="mt-6 flex justify-center">
              <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
