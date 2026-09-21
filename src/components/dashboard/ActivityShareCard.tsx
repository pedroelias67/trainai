"use client";
import { useState } from "react";

interface Props {
  activityId: string;
  /** Already published: the link exists and works for anyone who has it. */
  shareToken: string | null;
  /** The athlete's setting: hide the first and last stretch of the route. */
  trimMap: boolean;
  name: string;
  distance: string | null;
  duration: string | null;
  avgPace: string | null;
  avgHR: number | null;
  date: string;
  sport: string;
}

const sportLabels: Record<string, string> = {
  RUNNING: "Corrida", CYCLING: "Ciclismo", SWIMMING: "Natação",
};
const sportEmojis: Record<string, string> = {
  RUNNING: "🏃", CYCLING: "🚴", SWIMMING: "🏊",
};

export default function ActivityShareCard({
  activityId, shareToken, trimMap: initialTrim, name, distance, duration, avgPace, avgHR, date, sport,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState<string | null>(
    shareToken ? `${typeof window === "undefined" ? "" : window.location.origin}/t/${shareToken}` : null
  );
  const [trimMap, setTrimMap] = useState(initialTrim);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formattedDate = new Date(date).toLocaleDateString("pt-PT", {
    day: "numeric", month: "long", year: "numeric",
  });

  /**
   * Publishes the activity and hands back its public address.
   *
   * This used to share the address of this very page, which asks for a sign-in
   * and then checks the workout belongs to whoever signed in — so whoever
   * received it could make an account and still be told it does not exist.
   */
  async function publish(nextTrim = trimMap) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/activities/${activityId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trimMap: nextTrim }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao criar link");
      setUrl(data.url);
      return data.url as string;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function unpublish() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/activities/${activityId}/share`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao remover a partilha");
      setUrl(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  const handleShare = async () => {
    const link = url ?? (await publish());
    if (!link) return;

    const text = `${distance ? distance + "km" : ""} ${duration ? "em " + duration : ""} — ${name}`.trim();
    if (navigator.share) {
      try {
        await navigator.share({ title: `Completei ${name}`, text: `${text} | TrainAI`, url: link });
        return;
      } catch {
        // Cancelled, or no share sheet: the link is on screen either way.
      }
    }
    await navigator.clipboard.writeText(link).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-[var(--text-primary)] text-sm">Partilhar</h2>
        <button
          onClick={handleShare}
          disabled={busy}
          className="px-3 py-1.5 bg-[var(--bg-hover)] hover:bg-[var(--bg-hover)] border border-[var(--border-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
        >
          {busy ? "A preparar…" : copied ? "✓ Link copiado!" : url ? "↗ Partilhar" : "↗ Criar link"}
        </button>
      </div>

      <div className="mb-4 space-y-2">
        <label className="flex items-start gap-2.5 text-xs text-[var(--text-secondary)] cursor-pointer">
          <input
            type="checkbox"
            checked={trimMap}
            disabled={busy}
            onChange={async (e) => {
              setTrimMap(e.target.checked);
              if (url) await publish(e.target.checked);
            }}
            className="mt-0.5 accent-green-500"
          />
          <span>
            Esconder o início e o fim do percurso
            <span className="block text-[var(--text-faint)]">
              Um mapa de uma corrida matinal costuma ter a porta de casa nas duas pontas.
            </span>
          </span>
        </label>

        {url && (
          <div className="p-3 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-hover)] space-y-2">
            <p className="text-[var(--text-faint)] text-xs">Qualquer pessoa com este link vê o treino, sem criar conta:</p>
            <p className="text-[var(--text-secondary)] text-xs break-all font-mono">{url}</p>
            <button onClick={unpublish} disabled={busy}
              className="text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50">
              Deixar de partilhar
            </button>
          </div>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      {/* Share card visual */}
      <div className="rounded-xl overflow-hidden border border-[var(--border-hover)]" style={{ background: "#0a0a0a" }}>
        {/* Green accent bar */}
        <div className="h-1 bg-green-500" />

        <div className="p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-green-500 font-bold text-sm tracking-tight">TrainAI</span>
            <span className="text-[var(--text-faint)] text-xs">{formattedDate}</span>
          </div>

          {/* Distance — big number */}
          {distance && (
            <div className="mb-4">
              <span className="text-4xl font-black text-[var(--text-primary)]">{distance}</span>
              <span className="text-[var(--text-muted)] text-lg ml-1">km</span>
            </div>
          )}

          {/* Stats row */}
          <div className="flex items-center gap-4 mb-4">
            {duration && (
              <div>
                <p className="text-[var(--text-primary)] font-semibold text-sm">{duration}</p>
                <p className="text-[var(--text-faint)] text-xs">Duração</p>
              </div>
            )}
            {avgPace && (
              <div>
                <p className="text-[var(--text-primary)] font-semibold text-sm">{avgPace}</p>
                <p className="text-[var(--text-faint)] text-xs">Pace</p>
              </div>
            )}
            {avgHR && (
              <div>
                <p className="text-[var(--text-primary)] font-semibold text-sm">{avgHR} bpm</p>
                <p className="text-[var(--text-faint)] text-xs">FC Média</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-2 pt-3 border-t border-[var(--border)]">
            <span className="text-lg">{sportEmojis[sport] ?? "🏅"}</span>
            <span className="text-[var(--text-secondary)] text-xs">{sportLabels[sport] ?? sport} · {name}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
