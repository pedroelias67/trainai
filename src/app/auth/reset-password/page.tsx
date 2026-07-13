"use client";

import Link from "next/link";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogoFull } from "@/components/ui/Logo";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!token) {
    return (
      <div className="card text-center space-y-4">
        <div className="text-4xl">❌</div>
        <p className="text-red-400 text-sm">Link inválido ou em falta.</p>
        <Link href="/auth/forgot-password" className="text-green-400 hover:text-green-300 text-sm">
          Pedir novo link →
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password com mínimo 8 caracteres"); return; }
    if (password !== confirm) { setError("As passwords não coincidem"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao redefinir");
      router.push("/auth/login?reset=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm">{error}</div>
        )}
        <div>
          <label className="label">Nova password</label>
          <input
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 8 caracteres"
            required
          />
        </div>
        <div>
          <label className="label">Confirmar password</label>
          <input
            type="password"
            className="input"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repete a password"
            required
          />
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-2">
          {loading ? "A guardar…" : "Redefinir password"}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="flex justify-center mb-6"><LogoFull size={36} /></div>
          <h1 className="text-2xl font-bold text-white">Nova password</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">Define uma nova password para a tua conta</p>
        </div>
        <Suspense fallback={<div className="card text-center text-[var(--text-muted)] text-sm py-8">A carregar…</div>}>
          <ResetPasswordForm />
        </Suspense>
        <p className="text-center text-sm text-[var(--text-faint)] mt-6">
          <Link href="/auth/login" className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
            ← Voltar ao login
          </Link>
        </p>
      </div>
    </div>
  );
}
