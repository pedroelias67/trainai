"use client";

type Activity = {
  id: string;
  distance: number | null;
  duration: number | null;
  date: string;
};

type Props = {
  recentActivities: Activity[];
};

const RACE_DISTANCES = [
  { label: "5 km", meters: 5000 },
  { label: "10 km", meters: 10000 },
  { label: "Meia Maratona", meters: 21097 },
  { label: "Maratona", meters: 42195 },
];

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatPace(secondsPerKm: number): string {
  const m = Math.floor(secondsPerKm / 60);
  const s = Math.floor(secondsPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")}/km`;
}

// Riegel formula: T2 = T1 * (D2/D1)^1.06
function riegelPredict(t1Seconds: number, d1Meters: number, d2Meters: number): number {
  return t1Seconds * Math.pow(d2Meters / d1Meters, 1.06);
}

export function RacePrediction({ recentActivities }: Props) {
  // Filter activities with distance >= 5km and valid duration
  const validActivities = recentActivities.filter(
    (a) => a.distance !== null && a.distance >= 5000 && a.duration !== null && a.duration > 0
  );

  if (validActivities.length === 0) {
    return (
      <div className="bg-[#111] border border-[#1f1f1f] rounded-2xl p-5">
        <h3 className="font-bold text-white mb-1">Previsão de Tempos de Corrida</h3>
        <p className="text-zinc-500 text-sm">Sem dados suficientes (precisa de pelo menos 1 corrida ≥5km nos últimos 30 dias)</p>
      </div>
    );
  }

  // Find best pace (lowest seconds per meter) over 5km+
  let bestPacePerMeter = Infinity;
  let bestActivity: Activity | null = null;
  for (const a of validActivities) {
    const pacePerMeter = a.duration! / a.distance!;
    if (pacePerMeter < bestPacePerMeter) {
      bestPacePerMeter = pacePerMeter;
      bestActivity = a;
    }
  }

  const predictions = RACE_DISTANCES.map((race) => ({
    ...race,
    predictedSeconds: riegelPredict(
      bestActivity!.duration!,
      bestActivity!.distance!,
      race.meters
    ),
  }));

  // Trend: compare last 2 weeks pace vs previous 2 weeks
  const now = new Date();
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);

  const recentValid = validActivities.filter((a) => new Date(a.date) >= twoWeeksAgo);
  const previousValid = validActivities.filter(
    (a) => new Date(a.date) >= fourWeeksAgo && new Date(a.date) < twoWeeksAgo
  );

  let trendIcon = "";
  let trendText = "";
  if (recentValid.length > 0 && previousValid.length > 0) {
    const recentAvgPace =
      recentValid.reduce((sum, a) => sum + a.duration! / a.distance!, 0) / recentValid.length;
    const prevAvgPace =
      previousValid.reduce((sum, a) => sum + a.duration! / a.distance!, 0) / previousValid.length;
    const diff = ((prevAvgPace - recentAvgPace) / prevAvgPace) * 100;
    if (diff > 1) {
      trendIcon = "↑";
      trendText = `${Math.abs(diff).toFixed(1)}% mais rápido que nas 2 semanas anteriores`;
    } else if (diff < -1) {
      trendIcon = "↓";
      trendText = `${Math.abs(diff).toFixed(1)}% mais lento que nas 2 semanas anteriores`;
    } else {
      trendIcon = "→";
      trendText = "Ritmo estável nas últimas 4 semanas";
    }
  }

  const bestPacePerKm = bestPacePerMeter * 1000;

  return (
    <div className="bg-[#111] border border-[#1f1f1f] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-white">Previsão de Tempos de Corrida</h3>
          <p className="text-zinc-500 text-xs mt-0.5">
            Baseado no melhor ritmo recente: {formatPace(bestPacePerKm)}
            {trendText && (
              <span className={`ml-2 ${trendIcon === "↑" ? "text-green-400" : trendIcon === "↓" ? "text-red-400" : "text-zinc-400"}`}>
                {trendIcon} {trendText}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {predictions.map((p) => (
          <div key={p.label} className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl p-3 text-center">
            <p className="text-xs text-zinc-500 mb-1">{p.label}</p>
            <p className="text-lg font-bold text-white">{formatTime(p.predictedSeconds)}</p>
            <p className="text-xs text-zinc-600 mt-0.5">
              {formatPace((p.predictedSeconds / p.meters) * 1000)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
