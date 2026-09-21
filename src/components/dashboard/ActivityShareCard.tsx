"use client";
import { useEffect, useRef, useState } from "react";
import { projectTrack } from "@/lib/share-image";
import type { TrackPoint } from "@/lib/share-privacy";

interface Props {
  activityId: string;
  /** Already published: the link exists and works for anyone who has it. */
  shareToken: string | null;
  /** The athlete's setting: hide the first and last stretch of the route. */
  trimMap: boolean;
  /** The route for the image, already trimmed to the setting. Empty draws none. */
  route: TrackPoint[];
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
  activityId, shareToken, trimMap: initialTrim, route, name, distance, duration, avgPace, avgHR, date, sport,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  // A share sheet exists on phones and on some desktops, and nowhere else. The
  // buttons say what they will actually do — on a computer that is copying a
  // link and saving a file, not "sharing". Read after mount: the server has no
  // way to know, and guessing would make the first paint disagree with itself.
  const [hasShareSheet, setHasShareSheet] = useState(false);
  const [canShareFiles, setCanShareFiles] = useState(false);
  useEffect(() => {
    setHasShareSheet(typeof navigator !== "undefined" && typeof navigator.share === "function");
    setCanShareFiles(typeof navigator !== "undefined" && typeof navigator.canShare === "function");
  }, []);
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

  /**
   * Draws the card as a square image for the places a link is worse than a
   * picture — a chat, a story — where it is seen without anyone opening
   * anything, and carries no route beyond its own silhouette.
   */
  async function buildImage(): Promise<Blob | null> {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const S = 1080;
    canvas.width = S;
    canvas.height = S;
    // The page's own font, once the browser has it; otherwise whatever it has.
    await document.fonts?.ready?.catch(() => {});
    const font = (weight: number, size: number) => `${weight} ${size}px Inter, system-ui, sans-serif`;

    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = "#22c55e";
    ctx.fillRect(0, 0, S, 14);

    const pad = 88;
    ctx.textBaseline = "alphabetic";
    ctx.font = font(800, 46);
    ctx.fillStyle = "#22c55e";
    ctx.fillText("TrainAI", pad, 140);

    ctx.font = font(500, 32);
    ctx.fillStyle = "#8a8a94";
    ctx.textAlign = "right";
    ctx.fillText(formattedDate, S - pad, 140);
    ctx.textAlign = "left";

    if (distance) {
      ctx.font = font(900, 190);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(distance, pad, 330);
      const w = ctx.measureText(distance).width;
      ctx.font = font(600, 58);
      ctx.fillStyle = "#8a8a94";
      ctx.fillText("km", pad + w + 18, 330);
    }

    const stats = [
      duration ? { label: "Duração", value: duration } : null,
      avgPace ? { label: "Pace", value: avgPace } : null,
      avgHR ? { label: "FC média", value: `${avgHR} bpm` } : null,
    ].filter((s): s is { label: string; value: string } => s !== null);

    stats.forEach((stat, i) => {
      const x = pad + i * ((S - pad * 2) / Math.max(stats.length, 1));
      ctx.font = font(700, 50);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(stat.value, x, 440);
      ctx.font = font(500, 30);
      ctx.fillStyle = "#7e7e88";
      ctx.fillText(stat.label, x, 486);
    });

    const points = projectTrack(route, { width: S, height: 400, padding: pad });
    if (points.length > 1) {
      ctx.save();
      ctx.translate(0, 540);
      ctx.strokeStyle = "#22c55e";
      ctx.lineWidth = 10;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.stroke();
      ctx.restore();
    }

    ctx.font = font(500, 34);
    ctx.fillStyle = "#a1a1aa";
    const caption = `${sportLabels[sport] ?? sport} · ${name}`;
    ctx.fillText(caption.length > 46 ? `${caption.slice(0, 45)}…` : caption, pad, S - 80);

    return new Promise(resolve => canvas.toBlob(resolve, "image/png"));
  }

  async function shareImage() {
    setDrawing(true);
    setError(null);
    try {
      const blob = await buildImage();
      if (!blob) throw new Error("Não foi possível criar a imagem");
      const file = new File([blob], `trainai-${name.replace(/\s+/g, "-").toLowerCase()}.png`, { type: "image/png" });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: name }).catch(() => {});
      } else {
        // No share sheet — a download is the next best thing on a computer.
        const href = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href;
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(href), 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setDrawing(false);
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
          {busy ? "A preparar…" : copied ? "✓ Link copiado!" : hasShareSheet ? "↗ Partilhar" : "⧉ Copiar link"}
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

        <button onClick={shareImage} disabled={drawing}
          className="w-full px-3 py-2 rounded-xl border border-[var(--border-hover)] bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] text-xs font-medium transition-all disabled:opacity-50">
          {drawing ? "A desenhar…" : canShareFiles ? "🖼 Partilhar como imagem" : "🖼 Guardar imagem"}
        </button>
        <p className="text-[var(--text-faint)] text-xs">
          {canShareFiles
            ? "Para WhatsApp ou Instagram: vê-se sem abrir nada, e leva só a silhueta do percurso."
            : "Guarda um quadrado pronto a enviar, com a silhueta do percurso e mais nada."}
        </p>
      </div>
      <canvas ref={canvasRef} className="hidden" />

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
