"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Event = { id: string; name: string; date: string; distance: string };

/**
 * Generates a plan for a race the athlete has already entered.
 *
 * Without this, an account whose generation failed had one way back: the
 * onboarding, which asks for the race again and leaves the first one behind as a
 * duplicate.
 */
export function GeneratePlanForEvent({ events }: { events: Event[] }) {
  const router = useRouter();
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate(eventId: string) {
    setWorking(eventId);
    setError(null);
    try {
      const res = await fetch("/api/training-plans/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          res.status === 504
            ? "A geração demorou mais do que o permitido e foi interrompida. Tenta de novo."
            : data?.error ?? `Erro ao gerar plano (${res.status})`
        );
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    }
    setWorking(null);
  }

  if (events.length === 0) return null;

  return (
    <div className="mt-8 pt-6 border-t border-[var(--border)] text-left max-w-md mx-auto">
      <p className="text-[var(--text-secondary)] text-sm font-medium mb-3">
        {events.length === 1 ? "Já tens esta prova criada:" : "Já tens estas provas criadas:"}
      </p>
      <div className="space-y-2">
        {events.map((e) => (
          <div key={e.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-[var(--border-hover)] bg-[var(--bg-subtle)]">
            <div className="min-w-0">
              <p className="text-[var(--text-primary)] text-sm font-medium truncate">{e.name}</p>
              <p className="text-[var(--text-muted)] text-xs">
                {new Date(e.date).toLocaleDateString("pt-PT", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
            <button onClick={() => generate(e.id)} disabled={working !== null}
              className="btn-primary text-xs py-2 px-4 shrink-0 disabled:opacity-50">
              {working === e.id ? "A gerar…" : "Gerar plano"}
            </button>
          </div>
        ))}
      </div>
      {working && (
        <p className="text-[var(--text-muted)] text-xs mt-3">
          A IA está a construir o plano. Costuma demorar cerca de um minuto — não feches a página.
        </p>
      )}
      {error && <p className="text-red-400 text-xs mt-3">{error}</p>}
    </div>
  );
}
