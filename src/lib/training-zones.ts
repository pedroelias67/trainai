// Heart rate zones (Karvonen method when restingHR available)
export function calculateHRZones(maxHR: number, restingHR?: number) {
  const reserve = restingHR ? maxHR - restingHR : null;
  const zone = (pctLow: number, pctHigh: number) => {
    if (reserve && restingHR) {
      return { low: Math.round(restingHR + reserve * pctLow), high: Math.round(restingHR + reserve * pctHigh) };
    }
    return { low: Math.round(maxHR * pctLow), high: Math.round(maxHR * pctHigh) };
  };
  return [
    { name: "Z1 — Recuperação ativa", ...zone(0.50, 0.60), color: "bg-zinc-400", description: "Muito fácil, conversação fluida" },
    { name: "Z2 — Aeróbico base", ...zone(0.60, 0.70), color: "bg-green-400", description: "Fácil, base aeróbica, 80% do volume" },
    { name: "Z3 — Aeróbico moderado", ...zone(0.70, 0.80), color: "bg-yellow-400", description: "Moderado, limiar aeróbico" },
    { name: "Z4 — Limiar anaeróbico", ...zone(0.80, 0.90), color: "bg-orange-400", description: "Difícil, treino de tempo/limiar" },
    { name: "Z5 — VO2max", ...zone(0.90, 1.00), color: "bg-red-400", description: "Muito difícil, intervalos curtos" },
  ];
}

// Power zones based on FTP (Functional Threshold Power in watts)
export function calculatePowerZones(ftp: number) {
  return [
    { name: "Z1 — Recuperação ativa", low: 0, high: Math.round(ftp * 0.55), color: "bg-zinc-400", description: "Recuperação, sem stress fisiológico" },
    { name: "Z2 — Resistência", low: Math.round(ftp * 0.55), high: Math.round(ftp * 0.75), color: "bg-green-400", description: "Aeróbico base, longa duração" },
    { name: "Z3 — Tempo", low: Math.round(ftp * 0.75), high: Math.round(ftp * 0.90), color: "bg-yellow-400", description: "Aeróbico moderado, sustentável por 60-90min" },
    { name: "Z4 — Limiar (FTP)", low: Math.round(ftp * 0.90), high: Math.round(ftp * 1.05), color: "bg-orange-400", description: "Ritmo de limiar, 20-60min de esforço" },
    { name: "Z5 — VO2max", low: Math.round(ftp * 1.05), high: Math.round(ftp * 1.20), color: "bg-red-400", description: "Intervalos curtos de alta intensidade" },
    { name: "Z6 — Capacidade anaeróbica", low: Math.round(ftp * 1.20), high: Math.round(ftp * 1.50), color: "bg-purple-400", description: "Sprints, esforços muito curtos" },
  ];
}

// Pace zones based on threshold pace (ltPace in format "M:SS")
export function calculatePaceZones(ltPace: string) {
  const parts = ltPace.replace(/\/km$/, "").split(":");
  const min = parseInt(parts[0], 10);
  const sec = parseInt(parts[1] ?? "0", 10);
  const ltSec = min * 60 + sec; // seconds per km

  const formatPace = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

  return [
    { name: "Z1 — Recuperação", low: formatPace(ltSec * 1.30), high: "—", description: "Acima de 130% do pace de limiar" },
    { name: "Z2 — Aeróbico", low: formatPace(ltSec * 1.15), high: formatPace(ltSec * 1.30), description: "115–130% do pace de limiar" },
    { name: "Z3 — Tempo fácil", low: formatPace(ltSec * 1.05), high: formatPace(ltSec * 1.15), description: "105–115% do pace de limiar" },
    { name: "Z4 — Limiar", low: formatPace(ltSec * 0.98), high: formatPace(ltSec * 1.05), description: "98–105% do pace de limiar" },
    { name: "Z5 — VO2max", low: formatPace(ltSec * 0.90), high: formatPace(ltSec * 0.98), description: "90–98% do pace de limiar" },
  ];
}
