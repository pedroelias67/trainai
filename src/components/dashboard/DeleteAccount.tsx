"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteAccount() {
  const router = useRouter();
  const [step, setStep] = useState<"idle" | "confirm" | "loading">("idle");
  const [error, setError] = useState("");

  async function handleDelete() {
    setStep("loading");
    setError("");
    try {
      const res = await fetch("/api/account/delete", { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao eliminar conta");
      router.push("/auth/login?deleted=1");
    } catch {
      setError("Não foi possível eliminar a conta. Tenta novamente.");
      setStep("confirm");
    }
  }

  if (step === "idle") {
    return (
      <button
        onClick={() => setStep("confirm")}
        className="w-full py-3 rounded-xl border border-red-500/20 text-red-400 hover:bg-red-500/5 hover:border-red-500/40 text-sm transition-all"
      >
        Eliminar conta e todos os dados
      </button>
    );
  }

  if (step === "loading") {
    return (
      <div className="w-full py-3 rounded-xl border border-red-500/20 text-red-400/50 text-sm text-center">
        A eliminar…
      </div>
    );
  }

  return (
    <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/5 space-y-3">
      <p className="text-red-400 font-medium text-sm">Tens a certeza?</p>
      <p className="text-[var(--text-muted)] text-xs leading-relaxed">
        Esta ação é irreversível. Todos os teus dados serão eliminados permanentemente:
        conta, perfil, planos de treino, atividades e histórico.
      </p>
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleDelete}
          className="flex-1 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-colors"
        >
          Sim, eliminar tudo
        </button>
        <button
          onClick={() => setStep("idle")}
          className="flex-1 py-2 rounded-xl border border-[var(--border-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs transition-all"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
