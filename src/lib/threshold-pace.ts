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

/** How far each kind of session sits from threshold, in seconds per kilometre. */
const DESVIO_POR_TIPO: Record<string, number> = {
  RECOVERY: 120,
  EASY: 90,
  LONG: 85,
  TEMPO: 0,
  INTERVALS: -20,
};

/**
 * The pace a session of this kind should carry, given the athlete's threshold.
 *
 * Used when a session changes kind under the weekly adaptation. Converting an
 * interval session to an easy run used to change its type, its name, its
 * distance and its duration — and leave the interval pace on it. The athlete
 * was handed a 6.8 km easy run with a 4:38/km target and a coach's note telling
 * him to keep his heart rate under 142, all on the same screen and all on his
 * watch.
 *
 * Null for kinds that have no pace of their own, such as a race or strength
 * work, where whatever was there should be left alone.
 */
export function paceForSessionType(sessionType: string, thresholdSecPerKm: number): string | null {
  const desvio = DESVIO_POR_TIPO[sessionType];
  if (desvio === undefined) return null;
  return `${formatPace(thresholdSecPerKm + desvio)}/km`;
}

/** What a session converted to this kind should be called. */
const NOME_POR_TIPO: Record<string, string> = {
  RECOVERY: "Corrida de Recuperação Z1",
  EASY: "Corrida Fácil Z2",
  LONG: "Longo Aeróbico Z2",
  TEMPO: "Tempo Contínuo",
  INTERVALS: "Intervalos",
};

/**
 * A name that says what the session now is.
 *
 * It used to keep the old one behind a marker — "[Adaptado] Intervalos 10K —
 * 4x1200m" for something that is no longer intervals and no longer 1200s. On a
 * watch, where the name is most of what you see, that is simply wrong. What it
 * replaced is still recorded, in the coach's note that explains the change.
 */
export function nameForSessionType(sessionType: string): string | null {
  const nome = NOME_POR_TIPO[sessionType];
  return nome ? `[Adaptado] ${nome}` : null;
}
