// The pace everything else is measured against.
//
// A plan is written in paces, and the model needs something to anchor them to.
// Without one it invents: an athlete who races 10 km at 4:55 was given easy
// runs at 7:00 and an interval session at 5:10 — slower than the pace he had
// raced three days earlier. "Advanced" is not a pace, and kilometres per week
// do not say how fast they were run.
//
// So there is always an answer here, in descending order of trust:
//
//   1. What the athlete entered. Their own measurement wins.
//   2. Their best recent race or effort, through Daniels' VDOT.
//   3. A figure from their level, age and sex — a starting guess, and openly
//      labelled as one, for somebody who has not run with the app yet.
//
// Only the first two are ever written to the athlete's profile. The third
// steers the plan's prose and nothing else: it must not end up as a pace target
// on a watch, presented as though it had been measured.

import { estimateVO2max, type EffortRecord } from "@/lib/vo2max";
import { paceToSeconds } from "@/lib/format";

/** Daniels runs threshold work at about this share of VO2max. */
const SHARE_OF_VO2MAX = 0.88;

/**
 * The pace implied by a VDOT, in seconds per kilometre.
 *
 * Inverts the project's own oxygen-cost curve at the threshold intensity rather
 * than copying a table, so the two cannot disagree. Checked against Daniels:
 * VDOT 50 gives 4:15/km.
 */
export function thresholdPaceFromVdot(vdot: number): number | null {
  if (!Number.isFinite(vdot) || vdot <= 0) return null;

  // vo2 = -4.6 + 0.182258·v + 0.000104·v², solved for v.
  const alvo = SHARE_OF_VO2MAX * vdot;
  const a = 0.000104;
  const b = 0.182258;
  const c = -4.6 - alvo;
  const disc = b * b - 4 * a * c;
  if (disc <= 0) return null;

  const metresPerMin = (-b + Math.sqrt(disc)) / (2 * a);
  if (metresPerMin <= 0) return null;

  const segundosPorKm = Math.round(60000 / metresPerMin);
  return segundosPorKm > 120 && segundosPorKm < 900 ? segundosPorKm : null;
}

/**
 * Threshold pace for someone with nothing on record, by level, at 30 years old.
 *
 * Deliberately on the cautious side. A plan pitched slightly slow costs a few
 * easy weeks; one pitched fast costs an injury.
 */
const POR_NIVEL: Record<string, number> = {
  BEGINNER: 390,      // 6:30/km
  INTERMEDIATE: 330,  // 5:30/km
  ADVANCED: 280,      // 4:40/km
  ELITE: 225,         // 3:45/km
};

/** Endurance declines slowly from the late thirties; this is the usual rule of thumb. */
const DECLINIO_POR_ANO = 0.007;
const IDADE_SEM_DECLINIO = 35;
/** The average difference in distance-running performance between the sexes. */
const FACTOR_FEMININO = 1.1;

export type ThresholdSource = "declared" | "records" | "estimated";

export type ThresholdPace = {
  secondsPerKm: number;
  /** "5:00", as the profile stores it. */
  pace: string;
  source: ThresholdSource;
  /** One line saying where the number came from, in the athlete's language. */
  basis: string;
  /** Safe to write to the athlete's profile. False for a guess from their level. */
  trustworthy: boolean;
};

export type ThresholdInput = {
  declared?: string | null;
  records?: EffortRecord[];
  fitnessLevel?: string | null;
  age?: number | null;
  gender?: string | null;
};

export function formatPace(secondsPerKm: number): string {
  const m = Math.floor(secondsPerKm / 60);
  const s = Math.round(secondsPerKm % 60);
  return s === 60 ? `${m + 1}:00` : `${m}:${String(s).padStart(2, "0")}`;
}

/** The best answer available, and how good an answer it is. */
export function estimateThresholdPace(input: ThresholdInput, now = new Date()): ThresholdPace {
  const declarado = paceToSeconds(input.declared ?? null);
  if (declarado) {
    return {
      secondsPerKm: declarado,
      pace: formatPace(declarado),
      source: "declared",
      basis: "o ritmo de limiar que tens definido",
      trustworthy: true,
    };
  }

  const vo2 = input.records?.length ? estimateVO2max(input.records, now) : null;
  if (vo2) {
    const secs = thresholdPaceFromVdot(vo2.value);
    if (secs) {
      return {
        secondsPerKm: secs,
        pace: formatPace(secs),
        source: "records",
        basis: `a tua melhor marca recente — ${vo2.source}`,
        trustworthy: true,
      };
    }
  }

  const base = POR_NIVEL[input.fitnessLevel ?? "INTERMEDIATE"] ?? POR_NIVEL.INTERMEDIATE;
  const idade = input.age ?? 35;
  const anos = Math.max(0, idade - IDADE_SEM_DECLINIO);
  const comIdade = base * (1 + anos * DECLINIO_POR_ANO);
  const secs = Math.round(input.gender === "FEMALE" ? comIdade * FACTOR_FEMININO : comIdade);

  return {
    secondsPerKm: secs,
    pace: formatPace(secs),
    source: "estimated",
    basis: "uma estimativa pelo teu nível e idade, por ainda não haver corridas registadas",
    trustworthy: false,
  };
}

/** How this is put to the plan generator. */
export function thresholdGuidance(t: ThresholdPace): string {
  const linhas = [
    `RITMO DE LIMIAR: ${t.pace}/km (${t.basis}).`,
    "Escreve os ritmos do plano a partir deste valor, não do nível declarado:",
    `- Fácil e longo: ${formatPace(t.secondsPerKm + 75)} a ${formatPace(t.secondsPerKm + 110)}/km.`,
    `- Tempo / limiar: perto de ${t.pace}/km.`,
    `- Intervalos de 10K ou mais curtos: ${formatPace(t.secondsPerKm - 20)}/km ou mais rápido.`,
  ];
  if (!t.trustworthy) {
    linhas.push(
      "Este valor é um ponto de partida, não uma medição: mantém a primeira semana conservadora",
      "e diz ao atleta, na nota do treinador, que os ritmos se afinam assim que houver corridas.",
    );
  }
  return linhas.join("\n");
}
