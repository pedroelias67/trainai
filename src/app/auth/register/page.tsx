"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogoFull } from "@/components/ui/Logo";

type Step = "account" | "athlete";

const FITNESS_LEVELS = [
  { value: "BEGINNER", label: "Iniciante", desc: "< 1 ano de treino regular" },
  { value: "INTERMEDIATE", label: "Intermédio", desc: "1–3 anos, boa base aeróbica" },
  { value: "ADVANCED", label: "Avançado", desc: "3–7 anos, competições regulares" },
  { value: "ELITE", label: "Elite", desc: "+7 anos, alto rendimento" },
];

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("account");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [account, setAccount] = useState({ name: "", email: "", password: "" });
  const [athlete, setAthlete] = useState({
    dateOfBirth: "",
    gender: "MALE",
    fitnessLevel: "INTERMEDIATE",
    weeklyHours: 8,
    maxHR: "",
    restingHR: "",
  });

  async function handleAccountNext(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (account.password.length < 8) { setError("Password com mínimo 8 caracteres"); return; }
    setStep("athlete");
  }

  async function handleAthleteSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...account,
          athlete: {
            dateOfBirth: athlete.dateOfBirth || undefined,
            gender: athlete.gender,
            fitnessLevel: athlete.fitnessLevel,
            weeklyHours: Number(athlete.weeklyHours),
            maxHR: athlete.maxHR ? Number(athlete.maxHR) : undefined,
            restingHR: athlete.restingHR ? Number(athlete.restingHR) : undefined,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao criar conta");
      router.push("/onboarding");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="flex justify-center mb-6"><LogoFull size={36} /></div>
          <h1 className="text-2xl font-bold text-white">Criar conta</h1>
          <p className="text-zinc-500 text-sm mt-1">Começa o teu plano de treino personalizado</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6">
          {(["account", "athlete"] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                step === s ? "bg-green-500 text-black"
                : s === "account" && step === "athlete" ? "bg-green-500/20 text-green-400"
                : "bg-[#1a1a1a] text-zinc-600"
              }`}>
                {s === "account" && step === "athlete" ? "✓" : i + 1}
              </div>
              <span className={`text-xs ${step === s ? "text-white" : "text-zinc-600"}`}>
                {s === "account" ? "Conta" : "Perfil atleta"}
              </span>
              {i === 0 && <div className="flex-1 h-px bg-[#222]" />}
            </div>
          ))}
        </div>

        {step === "account" && (
          <div className="card">
            <form onSubmit={handleAccountNext} className="space-y-4">
              {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm">{error}</div>}
              <div>
                <label className="label">Nome</label>
                <input type="text" className="input" value={account.name}
                  onChange={(e) => setAccount({ ...account, name: e.target.value })}
                  placeholder="O teu nome" required />
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" className="input" value={account.email}
                  onChange={(e) => setAccount({ ...account, email: e.target.value })}
                  placeholder="o@exemplo.com" required />
              </div>
              <div>
                <label className="label">Password</label>
                <input type="password" className="input" value={account.password}
                  onChange={(e) => setAccount({ ...account, password: e.target.value })}
                  placeholder="Mínimo 8 caracteres" required />
              </div>
              <button type="submit" className="btn-primary w-full py-3 mt-2">Continuar →</button>
            </form>
          </div>
        )}

        {step === "athlete" && (
          <div className="card">
            <form onSubmit={handleAthleteSubmit} className="space-y-5">
              {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm">{error}</div>}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Data de nascimento</label>
                  <input type="date" className="input" value={athlete.dateOfBirth}
                    onChange={(e) => setAthlete({ ...athlete, dateOfBirth: e.target.value })} />
                </div>
                <div>
                  <label className="label">Género</label>
                  <select className="input" value={athlete.gender}
                    onChange={(e) => setAthlete({ ...athlete, gender: e.target.value })}>
                    <option value="MALE">Masculino</option>
                    <option value="FEMALE">Feminino</option>
                    <option value="OTHER">Outro</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="label">
                  Horas de treino por semana —{" "}
                  <span className="text-green-400 normal-case font-semibold">{athlete.weeklyHours}h</span>
                </label>
                <input type="range" min="3" max="20" value={athlete.weeklyHours}
                  onChange={(e) => setAthlete({ ...athlete, weeklyHours: Number(e.target.value) })}
                  className="w-full accent-green-500 mt-2" />
                <div className="flex justify-between text-xs text-zinc-600 mt-1"><span>3h</span><span>20h</span></div>
              </div>

              <div>
                <label className="label">Nível de condição física</label>
                <div className="space-y-2 mt-2">
                  {FITNESS_LEVELS.map((level) => (
                    <label key={level.value}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        athlete.fitnessLevel === level.value
                          ? "border-green-500/40 bg-green-500/5"
                          : "border-[#2a2a2a] hover:border-[#3a3a3a]"
                      }`}>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        athlete.fitnessLevel === level.value ? "border-green-500" : "border-[#3a3a3a]"
                      }`}>
                        {athlete.fitnessLevel === level.value && <div className="w-2 h-2 bg-green-500 rounded-full" />}
                      </div>
                      <input type="radio" name="fitnessLevel" value={level.value}
                        checked={athlete.fitnessLevel === level.value}
                        onChange={() => setAthlete({ ...athlete, fitnessLevel: level.value })}
                        className="sr-only" />
                      <div>
                        <p className="text-sm font-medium text-white">{level.label}</p>
                        <p className="text-xs text-zinc-500">{level.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">FC Máxima <span className="normal-case text-zinc-600">(opcional)</span></label>
                  <input type="number" className="input" value={athlete.maxHR}
                    onChange={(e) => setAthlete({ ...athlete, maxHR: e.target.value })}
                    placeholder="ex: 185" min="100" max="220" />
                </div>
                <div>
                  <label className="label">FC Repouso <span className="normal-case text-zinc-600">(opcional)</span></label>
                  <input type="number" className="input" value={athlete.restingHR}
                    onChange={(e) => setAthlete({ ...athlete, restingHR: e.target.value })}
                    placeholder="ex: 48" min="30" max="100" />
                </div>
              </div>
              <p className="text-xs text-zinc-600">A FC máxima permite calcular zonas de treino precisas. Podes adicionar mais tarde.</p>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setStep("account")}
                  className="btn-secondary flex-1 py-3">← Voltar</button>
                <button type="submit" disabled={loading} className="btn-primary flex-1 py-3">
                  {loading ? "A criar…" : "Criar conta →"}
                </button>
              </div>
            </form>
          </div>
        )}

        <p className="text-center text-sm text-zinc-600 mt-6">
          Já tens conta?{" "}
          <Link href="/auth/login" className="text-green-400 hover:text-green-300 font-medium">Entrar</Link>
        </p>
      </div>
    </div>
  );
}
