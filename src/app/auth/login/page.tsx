"use client";

import Link from "next/link";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogoFull } from "@/components/ui/Logo";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resetSuccess = searchParams.get("reset") === "1";
  const oauthError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao entrar");
      router.push(data.redirectTo ?? "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="flex justify-center mb-6">
            <LogoFull size={36} />
          </div>
          <h1 className="text-2xl font-bold text-white">Bem-vindo de volta</h1>
          <p className="text-zinc-500 text-sm mt-1">Entra para continuar o teu treino</p>
        </div>

        {resetSuccess && (
          <div className="bg-green-500/10 border border-green-500/20 text-green-400 px-4 py-3 rounded-xl text-sm mb-4">
            Password redefinida com sucesso. Podes entrar agora.
          </div>
        )}
        {oauthError && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm mb-4">
            {oauthError === "token_expired"
              ? "O link de confirmação expirou. Regista-te novamente."
              : oauthError === "invalid_token"
              ? "Link de confirmação inválido."
              : "Erro ao autenticar com Google. Tenta novamente."}
          </div>
        )}

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

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="o@exemplo.com" required />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="label mb-0">Password</label>
                <Link href="/auth/forgot-password" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                  Esqueceste a password?
                </Link>
              </div>
              <input type="password" className="input" value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" required />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-2">
              {loading ? "A entrar..." : "Entrar"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-zinc-600 mt-6">
          Não tens conta?{" "}
          <Link href="/auth/register" className="text-green-400 hover:text-green-300 font-medium">
            Criar conta
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0a]" />}>
      <LoginForm />
    </Suspense>
  );
}
