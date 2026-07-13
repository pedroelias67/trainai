"use client";
import { useState } from "react";

interface Props {
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

export default function ActivityShareCard({ name, distance, duration, avgPace, avgHR, date, sport }: Props) {
  const [copied, setCopied] = useState(false);

  const formattedDate = new Date(date).toLocaleDateString("pt-PT", {
    day: "numeric", month: "long", year: "numeric",
  });

  const handleShare = async () => {
    const text = `${distance ? distance + "km" : ""} ${duration ? "em " + duration : ""} — ${name}`.trim();
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Completei ${name}`,
          text: `${text} | TrainAI`,
          url: window.location.href,
        });
      } catch {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-white text-sm">Partilhar</h2>
        <button
          onClick={handleShare}
          className="px-3 py-1.5 bg-[var(--bg-hover)] hover:bg-[#252525] border border-[var(--border-hover)] text-[var(--text-secondary)] hover:text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
        >
          {copied ? "✓ Link copiado!" : "↗ Partilhar"}
        </button>
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
              <span className="text-4xl font-black text-white">{distance}</span>
              <span className="text-[var(--text-muted)] text-lg ml-1">km</span>
            </div>
          )}

          {/* Stats row */}
          <div className="flex items-center gap-4 mb-4">
            {duration && (
              <div>
                <p className="text-white font-semibold text-sm">{duration}</p>
                <p className="text-[var(--text-faint)] text-xs">Duração</p>
              </div>
            )}
            {avgPace && (
              <div>
                <p className="text-white font-semibold text-sm">{avgPace}</p>
                <p className="text-[var(--text-faint)] text-xs">Pace</p>
              </div>
            )}
            {avgHR && (
              <div>
                <p className="text-white font-semibold text-sm">{avgHR} bpm</p>
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
