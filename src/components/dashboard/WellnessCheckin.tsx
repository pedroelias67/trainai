"use client";

import { useState, useEffect } from "react";

interface WellnessData {
  sleepQuality: number;
  fatigue: number;
  mood: number;
  musclesSore: number;
  notes: string;
}

const METRICS: Array<{ key: keyof WellnessData; label: string; low: string; high: string; emoji: string; invert?: boolean }> = [
  { key: "sleepQuality", label: "Sono",     low: "Mau",     high: "Excelente",    emoji: "😴" },
  { key: "fatigue",      label: "Fadiga",   low: "Fresco",  high: "Esgotado",     emoji: "🔋", invert: true },
  { key: "mood",         label: "Humor",    low: "Mau",     high: "Ótimo",        emoji: "😊" },
  { key: "musclesSore",  label: "Músculos", low: "Frescos", high: "Muito doridos", emoji: "💪", invert: true },
];

function ScaleButton({ value, selected, invert, onClick }: {
  value: number; selected: boolean; invert?: boolean; onClick: () => void;
}) {
  const colors = invert
    ? ["bg-green-500/80", "bg-green-400/60", "bg-yellow-400/60", "bg-orange-400/60", "bg-red-500/80"]
    : ["bg-red-500/80", "bg-orange-400/60", "bg-yellow-400/60", "bg-green-400/60", "bg-green-500/80"];
  return (
    <button
      onClick={onClick}
      className={`w-9 h-9 rounded-lg text-sm font-bold transition-all border-2 ${
        selected
          ? `${colors[value - 1]} border-white text-white scale-110`
          : "bg-white/5 border-transparent text-[var(--text-muted)] hover:bg-white/10"
      }`}
    >
      {value}
    </button>
  );
}

export function WellnessCheckin() {
  const [data, setData] = useState<Partial<WellnessData>>({});
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch("/api/wellness")
      .then(r => r.json())
      .then(({ log }) => {
        if (log) {
          setData({
            sleepQuality: log.sleepQuality,
            fatigue: log.fatigue,
            mood: log.mood,
            musclesSore: log.musclesSore,
          });
          setNotes(log.notes ?? "");
          setSaved(true);
        }
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    await fetch("/api/wellness", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, notes }),
    });
    setSaved(true);
    setOpen(false);
  };

  const overallScore = () => {
    const vals = [data.sleepQuality, data.mood].filter(Boolean) as number[];
    const inverted = [data.fatigue, data.musclesSore].filter(Boolean) as number[];
    const all = [...vals, ...inverted.map(v => 6 - v)];
    if (!all.length) return null;
    return Math.round(all.reduce((a, b) => a + b) / all.length * 10) / 10;
  };

  const score = overallScore();
  const scoreColor = !score ? "text-[var(--text-muted)]"
    : score >= 4 ? "text-green-400"
    : score >= 3 ? "text-yellow-400"
    : "text-red-400";

  if (loading) return null;

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-white text-sm">Como te sentes hoje?</h3>
          {saved && score !== null && (
            <p className={`text-xs mt-0.5 ${scoreColor}`}>
              Estado geral: {score}/5 · {score >= 4 ? "Pronto para treinar" : score >= 3 ? "Razoável" : "Dia de recuperação recomendado"}
            </p>
          )}
          {!saved && (
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Regista o teu bem-estar diário</p>
          )}
        </div>
        <button
          onClick={() => setOpen(o => !o)}
          className="px-3 py-1.5 bg-white/10 hover:bg-white/15 text-white text-xs font-medium rounded-lg transition-colors"
        >
          {saved ? "Editar" : "Registar"}
        </button>
      </div>

      {saved && !open && (
        <div className="flex gap-4 mt-3 pt-3 border-t border-[var(--border)]">
          {METRICS.map(m => {
            const val = data[m.key as keyof WellnessData] as number | undefined;
            return val ? (
              <div key={m.key} className="flex flex-col items-center gap-0.5">
                <span className="text-base">{m.emoji}</span>
                <span className="text-[10px] text-[var(--text-faint)]">{m.label}</span>
                <span className={`text-xs font-bold ${
                  (m.invert ? 6 - val : val) >= 4 ? "text-green-400" : (m.invert ? 6 - val : val) >= 3 ? "text-yellow-400" : "text-red-400"
                }`}>{val}/5</span>
              </div>
            ) : null;
          })}
        </div>
      )}

      {open && (
        <div className="mt-4 space-y-4 pt-3 border-t border-[var(--border)]">
          {METRICS.map(m => (
            <div key={m.key}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-[var(--text-secondary)]">{m.emoji} {m.label}</span>
                <span className="text-[10px] text-[var(--text-faint)]">{m.low} → {m.high}</span>
              </div>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(v => (
                  <ScaleButton
                    key={v}
                    value={v}
                    selected={data[m.key as keyof WellnessData] === v}
                    invert={m.invert}
                    onClick={() => setData(d => ({ ...d, [m.key]: v }))}
                  />
                ))}
              </div>
            </div>
          ))}

          <div>
            <label className="text-xs text-[var(--text-secondary)] block mb-1">Notas (opcional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Ex: pernas pesadas, dormi mal, stress no trabalho..."
              rows={2}
              className="w-full bg-white/5 border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-white placeholder-[var(--text-faint)] resize-none focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={!data.sleepQuality && !data.fatigue && !data.mood && !data.musclesSore}
            className="w-full py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-40 text-black font-semibold text-sm rounded-lg transition-colors"
          >
            Guardar
          </button>
        </div>
      )}
    </div>
  );
}
