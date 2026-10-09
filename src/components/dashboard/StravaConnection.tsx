"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * The Strava link, and a way out of it.
 *
 * There was no way out. An athlete who authorised the wrong account — a browser
 * signed in as someone else — was bound to it, and the app showed a healthy
 * green link that would never deliver a single activity. Whose account it is
 * now says so on the page, which is the part that would have caught it on the
 * first day rather than the fortieth.
 */
export function StravaConnection({
  connected,
  athleteName,
  athleteId,
}: {
  connected: boolean;
  athleteName: string | null;
  athleteId: string | null;
}) {
  const router = useRouter();
  const [confirmar, setConfirmar] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nota, setNota] = useState<string | null>(null);

  async function desligar() {
    setWorking(true);
    setError(null);
    try {
      const res = await fetch("/api/strava/connect", { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? `Erro ao desligar (${res.status})`);
      setNota(data?.message ?? "Strava desligado.");
      setConfirmar(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <svg viewBox="0 0 24 24" className="w-8 h-8 fill-orange-400 shrink-0">
            <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
          </svg>
          <div className="min-w-0">
            <p className="text-[var(--text-primary)] text-sm font-medium">Strava</p>
            {connected ? (
              <p className="text-[var(--text-muted)] text-xs truncate">
                {athleteName ? (
                  <>
                    Conectado como{" "}
                    <strong className="text-[var(--text-secondary)] font-medium">{athleteName}</strong>
                  </>
                ) : (
                  "Conectado · sincronização automática ativa"
                )}
                {athleteId && (
                  <>
                    {" · "}
                    <a
                      href={`https://www.strava.com/athletes/${athleteId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2 hover:text-[var(--text-secondary)]"
                    >
                      ver no Strava
                    </a>
                  </>
                )}
              </p>
            ) : (
              <p className="text-[var(--text-muted)] text-xs">Não conectado</p>
            )}
          </div>
        </div>

        {connected ? (
          confirmar ? (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={desligar}
                disabled={working}
                className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
              >
                {working ? "A desligar…" : "Confirmar"}
              </button>
              <button onClick={() => setConfirmar(false)} className="text-xs text-[var(--text-muted)]">
                Não
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setConfirmar(true); setNota(null); }}
              className="text-xs text-[var(--text-muted)] hover:text-red-400 shrink-0 transition-colors"
            >
              Desligar
            </button>
          )
        ) : (
          <a href="/api/strava/connect" className="btn-primary text-xs py-2 shrink-0">
            Conectar
          </a>
        )}
      </div>

      {confirmar && (
        <p className="mt-2 text-xs text-[var(--text-muted)] leading-relaxed">
          As atividades que já chegaram ficam — são o teu histórico. O acesso é retirado também do
          lado do Strava, e podes voltar a ligar quando quiseres.
        </p>
      )}
      {nota && <p className="mt-2 text-xs text-[var(--text-secondary)]">{nota}</p>}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
