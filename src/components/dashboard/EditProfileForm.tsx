"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  initial: {
    name: string;
    dateOfBirth: string;
    gender: string;
    fitnessLevel: string;
    weeklyHours: number;
    maxHR: number | null;
    restingHR: number | null;
    ltPace: string | null;
    ftp: number | null;
    weightKg: number | null;
    heightCm: number | null;
    weightGoal: string | null;
    dietaryRestrictions: string | null;
  };
}

const FITNESS_LEVELS = [
  { value: "BEGINNER", label: "Iniciante" },
  { value: "INTERMEDIATE", label: "Intermédio" },
  { value: "ADVANCED", label: "Avançado" },
  { value: "ELITE", label: "Elite" },
];

export function EditProfileForm({ initial }: Props) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);
    try {
      // Update user name
      await fetch("/api/auth/update-name", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name }),
      });

      // Update athlete profile
      const res = await fetch("/api/athletes/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dateOfBirth: form.dateOfBirth || undefined,
          gender: form.gender,
          fitnessLevel: form.fitnessLevel,
          weeklyHours: form.weeklyHours,
          maxHR: form.maxHR || undefined,
          restingHR: form.restingHR || undefined,
          ltPace: form.ltPace || undefined,
          ftp: form.ftp || undefined,
          weightKg: form.weightKg || undefined,
          heightCm: form.heightCm || undefined,
          weightGoal: form.weightGoal || undefined,
          dietaryRestrictions: form.dietaryRestrictions || undefined,
        }),
      });
      if (!res.ok) throw new Error("Erro ao guardar");
      setSuccess(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm">{error}</div>}
      {success && <div className="bg-green-500/10 border border-green-500/20 text-green-400 px-4 py-3 rounded-xl text-sm">Perfil atualizado com sucesso</div>}

      {/* Personal */}
      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-white">Dados pessoais</h3>
        <div>
          <label className="label">Nome</label>
          <input type="text" className="input" value={form.name}
            onChange={(e) => set("name", e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Data de nascimento</label>
            <input type="date" className="input" value={form.dateOfBirth}
              onChange={(e) => set("dateOfBirth", e.target.value)} />
          </div>
          <div>
            <label className="label">Género</label>
            <select className="input" value={form.gender} onChange={(e) => set("gender", e.target.value)}>
              <option value="MALE">Masculino</option>
              <option value="FEMALE">Feminino</option>
              <option value="OTHER">Outro</option>
            </select>
          </div>
        </div>
      </div>

      {/* Athletic */}
      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-white">Dados de atleta</h3>

        <div>
          <label className="label">Nível de condição física</label>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {FITNESS_LEVELS.map((l) => (
              <button key={l.value} type="button" onClick={() => set("fitnessLevel", l.value)}
                className={`py-2.5 px-3 rounded-xl text-sm font-medium border text-left transition-all ${
                  form.fitnessLevel === l.value
                    ? "bg-green-500/10 text-green-400 border-green-500/30"
                    : "bg-[var(--bg-hover)] text-[var(--text-secondary)] border-[var(--border-hover)] hover:border-[var(--border-strong)]"
                }`}>
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">
            Horas disponíveis por semana —{" "}
            <span className="text-green-400 normal-case font-semibold">{form.weeklyHours}h</span>
          </label>
          <input type="range" min="3" max="20" value={form.weeklyHours}
            onChange={(e) => set("weeklyHours", Number(e.target.value))}
            className="w-full accent-green-500 mt-2" />
          <div className="flex justify-between text-xs text-[var(--text-faint)] mt-1"><span>3h</span><span>20h</span></div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">FC Máxima <span className="normal-case text-[var(--text-faint)]">bpm</span></label>
            <input type="number" className="input" value={form.maxHR ?? ""}
              onChange={(e) => set("maxHR", e.target.value ? Number(e.target.value) : null)}
              placeholder="ex: 185" min="100" max="220" />
          </div>
          <div>
            <label className="label">FC Repouso <span className="normal-case text-[var(--text-faint)]">bpm</span></label>
            <input type="number" className="input" value={form.restingHR ?? ""}
              onChange={(e) => set("restingHR", e.target.value ? Number(e.target.value) : null)}
              placeholder="ex: 48" min="30" max="100" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Pace de Limiar <span className="normal-case text-[var(--text-faint)]">min/km</span></label>
            <input type="text" className="input" value={form.ltPace ?? ""}
              onChange={(e) => set("ltPace", e.target.value)}
              placeholder="ex: 4:45/km" />
          </div>
          <div>
            <label className="label">FTP <span className="normal-case text-[var(--text-faint)]">watts</span></label>
            <input type="number" className="input" value={form.ftp ?? ""}
              onChange={(e) => set("ftp", e.target.value ? Number(e.target.value) : null)}
              placeholder="ex: 230" min="50" max="500" />
          </div>
        </div>
        <p className="text-xs text-[var(--text-faint)]">FC Máxima e Pace de Limiar são usados para calcular zonas de treino precisas nos planos gerados por IA.</p>
      </div>

      {/* Nutrition */}
      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Dados para plano nutricional</h3>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Peso <span className="normal-case text-[var(--text-faint)]">kg</span></label>
            <input type="number" className="input" value={form.weightKg ?? ""}
              onChange={(e) => set("weightKg", e.target.value ? Number(e.target.value) : null)}
              placeholder="ex: 72" min="30" max="200" step="0.1" />
          </div>
          <div>
            <label className="label">Altura <span className="normal-case text-[var(--text-faint)]">cm</span></label>
            <input type="number" className="input" value={form.heightCm ?? ""}
              onChange={(e) => set("heightCm", e.target.value ? Number(e.target.value) : null)}
              placeholder="ex: 175" min="100" max="250" />
          </div>
        </div>

        <div>
          <label className="label">Objetivo de peso</label>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {[
              { value: "lose", label: "Perder" },
              { value: "maintain", label: "Manter" },
              { value: "gain", label: "Ganhar" },
            ].map((o) => (
              <button key={o.value} type="button" onClick={() => set("weightGoal", o.value)}
                className={`py-2.5 px-3 rounded-xl text-sm font-medium border transition-all ${
                  form.weightGoal === o.value
                    ? "bg-green-500/10 text-green-400 border-green-500/30"
                    : "bg-[var(--bg-hover)] text-[var(--text-secondary)] border-[var(--border-hover)] hover:border-[var(--border-strong)]"
                }`}>
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Restrições alimentares <span className="normal-case text-[var(--text-faint)]">(opcional)</span></label>
          <input type="text" className="input" value={form.dietaryRestrictions ?? ""}
            onChange={(e) => set("dietaryRestrictions", e.target.value)}
            placeholder="ex: vegetariano, intolerante ao glúten" />
        </div>
      </div>

      <button type="submit" disabled={loading} className="btn-primary w-full py-3">
        {loading ? "A guardar…" : "Guardar alterações"}
      </button>
    </form>
  );
}
