"use client";

import Link from "next/link";
import { useState } from "react";
import { LogoFull } from "@/components/ui/Logo";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch {
      setError("Erro inesperado. Tenta novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="flex justify-center mb-6"><LogoFull size={36} /></div>
          <h1 className="text-2xl font-bold text-white">Recuperar password</h1>
          <p className="text-zinc-500 text-sm mt-1">Envia-te um link para redefinires a password</p>
        </div>

        <div className="card">
          {sent ? (
            <div className="text-center space-y-4 py-4">
              <div className="text-4xl">📬</div>
              <h2 className="text-white font-semibold">Email enviado</h2>
              <p className="text-zinc-400 text-sm">
                Se existir uma conta com esse email, enviámos instruções para recuperares a password.
              </p>
              <p className="text-zinc-600 text-xs">Verifica também a pasta de spam.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm">{error}</div>
              )}
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="o@exemplo.com"
                  required
                />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-2">
                {loading ? "A enviar…" : "Enviar link de recuperação"}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-zinc-600 mt-6">
          <Link href="/auth/login" className="text-zinc-500 hover:text-zinc-300 transition-colors">
            ← Voltar ao login
          </Link>
        </p>
      </div>
    </div>
  );
}
