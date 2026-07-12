"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogoFull } from "@/components/ui/Logo";
import { Suspense } from "react";

type Step = "account" | "athlete";

const FITNESS_LEVELS = [
  { value: "BEGINNER", label: "Iniciante", desc: "< 1 ano de treino regular" },
  { value: "INTERMEDIATE", label: "Intermédio", desc: "1–3 anos, boa base aeróbica" },
  { value: "ADVANCED", label: "Avançado", desc: "3–7 anos, competições regulares" },
  { value: "ELITE", label: "Elite", desc: "+7 anos, alto rendimento" },
];

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite") ?? "";

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
          inviteToken: inviteToken || undefined,
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
      router.push(`/auth/verify-email?email=${encodeURIComponent(account.email)}`);
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
          <p className="text-zinc-500 text-sm mt-1">
            Começa o teu plano de treino personalizado
          </p>
          {inviteToken && (
            <span className="inline-block mt-2 text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-1 rounded-full">
              Convite válido ✓
            </span>
          )}
        </div>

        {step === "account" && (
          <>
            {/* Google OAuth button */}
            <a
              href="/api/auth/google"
              className="flex items-center justify-center gap-3 w-full py-3 px-4 mb-4 rounded-xl border border-[#2a2a2a] bg-[#111] hover:bg-[#1a1a1a] hover:border-[#3a3a3a] transition-all text-white text-sm font-medium"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.64 9.2045C17.64 8.5664 17.5827 7.9527 17.4764 7.3636H9V10.845H13.8436C13.635 11.9700 13.0009 12.9232 12.0477 13.5613V15.8195H14.9564C16.6582 14.2527 17.64 11.9455 17.64 9.2045Z" fill="#4285F4"/>
                <path d="M9 18C11.43 18 13.4673 17.1941 14.9564 15.8195L12.0477 13.5613C11.2418 14.1013 10.2109 14.4204 9 14.4204C6.65591 14.4204 4.67182 12.8372 3.96409 10.71H0.957275V13.0418C2.43818 15.9831 5.48182 18 9 18Z" fill="#34A853"/>
                <path d="M3.96409 10.71C3.78409 10.17 3.68182 9.5932 3.68182 9C3.68182 8.4068 3.78409 7.83 3.96409 7.29V4.9582H0.957275C0.347727 6.1732 0 7.5477 0 9C0 10.4523 0.347727 11.8268 0.957275 13.0418L3.96409 10.71Z" fill="#FBBC05"/>
                <path d="M9 3.5795C10.3214 3.5795 11.5077 4.0336 12.4405 4.9255L15.0218 2.3441C13.4632 0.8918 11.4259 0 9 0C5.48182 0 2.43818 2.0168 0.957275 4.9582L3.96409 7.29C4.67182 5.1627 6.65591 3.5795 9 3.5795Z" fill="#EA4335"/>
              </svg>
              Continuar com Google
            </a>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-[#1f1f1f]" />
              <span className="text-zinc-600 text-xs">ou</span>
              <div className="flex-1 h-px bg-[#1f1f1f]" />
            </div>
          </>
        )}

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

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0a]" />}>
      <RegisterForm />
    </Suspense>
  );
}
