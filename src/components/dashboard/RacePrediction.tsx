"use client";

// Riegel formula: T2 = T1 × (D2/D1)^1.06
function riegel(knownTimeSecs: number, knownDistM: number, targetDistM: number): number {
  return knownTimeSecs * Math.pow(targetDistM / knownDistM, 1.06);
}

function formatTime(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.round(secs % 60);
  if (h > 0) return `${h}h${String(m).padStart(2, "0")}m${String(s).padStart(2, "0")}s`;
  return `${m}m${String(s).padStart(2, "0")}s`;
}

interface PersonalRecord {
  distance: number;
  timeSeconds: number;
}

interface Props {
  records: PersonalRecord[];
  recentBestPaceSec: number | null;
  recentBestDistM: number | null;
  targetDistance: string;
}

const RACE_DISTANCES: Record<string, { label: string; meters: number }> = {
  FIVE_K:            { label: "5 km",            meters: 5000 },
  TEN_K:             { label: "10 km",            meters: 10000 },
  HALF_MARATHON:     { label: "Meia Maratona",    meters: 21097 },
  MARATHON:          { label: "Maratona",         meters: 42195 },
  SPRINT_TRIATHLON:  { label: "Sprint Triathlon", meters: 5000 },
  OLYMPIC_TRIATHLON: { label: "Olímpico",         meters: 10000 },
  HALF_IRONMAN:      { label: "Half Ironman",     meters: 21097 },
  IRONMAN:           { label: "Ironman",          meters: 42195 },
};

const REFERENCE_DISTANCES = [
  { label: "5K",     meters: 5000 },
  { label: "10K",    meters: 10000 },
  { label: "Meia",   meters: 21097 },
  { label: "Marat.", meters: 42195 },
];

export function RacePrediction({ records, recentBestPaceSec, recentBestDistM, targetDistance }: Props) {
  const target = RACE_DISTANCES[targetDistance];
  if (!target) return null;

  let bestTimeSecs: number | null = null;
  let bestDistM: number | null = null;
  let source = "";

  if (records.length > 0) {
    const sorted = [...records].sort((a, b) =>
      Math.abs(a.distance * 1000 - target.meters) - Math.abs(b.distance * 1000 - target.meters)
    );
    bestTimeSecs = sorted[0].timeSeconds;
    bestDistM = sorted[0].distance * 1000;
    source = `baseado no teu recorde de ${sorted[0].distance}km`;
  } else if (recentBestPaceSec && recentBestDistM && recentBestDistM >= 3000) {
    bestTimeSecs = recentBestPaceSec * (recentBestDistM / 1000);
    bestDistM = recentBestDistM;
    source = "baseado no pace médio recente";
  }

  if (!bestTimeSecs || !bestDistM) {
    return (
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
        <h3 className="font-bold text-[var(--text-primary)]">⏱ Previsão de Tempo de Prova</h3>
        <p className="text-sm text-[var(--text-muted)] mt-2">
          Sem dados suficientes. Sincroniza atividades de corrida para ver a previsão.
        </p>
      </div>
    );
  }

  const predictedSecs = riegel(bestTimeSecs, bestDistM, target.meters);
  const paceSecs = predictedSecs / (target.meters / 1000);
  const paceStr = `${Math.floor(paceSecs / 60)}:${String(Math.round(paceSecs % 60)).padStart(2, "0")}/km`;

  const allPredictions = REFERENCE_DISTANCES.map(d => ({
    ...d,
    timeSecs: riegel(bestTimeSecs!, bestDistM!, d.meters),
  }));

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 space-y-4">
      <div>
        <h3 className="font-bold text-[var(--text-primary)]">⏱ Previsão de Tempo de Prova</h3>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">{source} · Fórmula de Riegel</p>
      </div>

      <div className="bg-[var(--accent)]/10 border border-[var(--accent)]/20 rounded-xl p-4 text-center">
        <p className="text-xs text-[var(--accent)] font-medium mb-1">{target.label}</p>
        <p className="text-3xl font-bold text-white">{formatTime(predictedSecs)}</p>
        <p className="text-xs text-[var(--text-muted)] mt-1">Pace médio {paceStr}</p>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {allPredictions.map(p => {
          const isTarget = Math.abs(p.meters - target.meters) < 100;
          return (
            <div
              key={p.label}
              className={`rounded-xl p-3 text-center ${isTarget ? "bg-[var(--accent)]/15 border border-[var(--accent)]/30" : "bg-white/5"}`}
            >
              <p className="text-[10px] text-[var(--text-faint)]">{p.label}</p>
              <p className={`text-sm font-bold mt-0.5 ${isTarget ? "text-[var(--accent)]" : "text-[var(--text-primary)]"}`}>
                {formatTime(p.timeSecs)}
              </p>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-[var(--text-faint)] text-center">
        Previsões baseadas no teu estado de forma atual. Melhoram à medida que treinas.
      </p>
    </div>
  );
}
