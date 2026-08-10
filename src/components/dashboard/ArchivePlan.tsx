"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ArchivePlan({ planId }: { planId: string }) {
  const [step, setStep] = useState<"idle" | "confirm" | "loading">("idle");
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleArchive() {
    setStep("loading");
    setError("");
    try {
      const res = await fetch(`/api/training-plans/${planId}/archive`, { method: "POST" });
      if (!res.ok) throw new Error();
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Erro ao arquivar. Tenta novamente.");
      setStep("confirm");
    }
  }

  if (step === "idle") {
    return (
      <button
        onClick={() => setStep("confirm")}
        className="text-sm text-[var(--text-faint)] hover:text-red-400 transition-colors"
      >
        Arquivar plano
      </button>
    );
  }

  if (step === "confirm") {
    return (
      <div className="flex items-center gap-3 flex-wrap">
        <p className="text-sm text-[var(--text-muted)]">Tens a certeza? O plano ficará arquivado.</p>
        <button
          onClick={handleArchive}
          className="text-sm font-medium text-red-400 hover:text-red-300 transition-colors"
        >
          Confirmar
        </button>
        <button
          onClick={() => setStep("idle")}
          className="text-sm text-[var(--text-faint)] hover:text-[var(--text-muted)] transition-colors"
        >
          Cancelar
        </button>
        {error && <p className="text-red-400 text-xs w-full">{error}</p>}
      </div>
    );
  }

  return <p className="text-sm text-[var(--text-faint)]">A arquivar…</p>;
}
