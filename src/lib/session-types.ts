// Session type labels and what each one is for.
//
// The labels were duplicated across five screens, which is partly why none of
// them ever explained anything: "Brick" and "Tempo" mean nothing to someone new
// to the sport, and the plan is full of them.

export type SessionTypeInfo = {
  label: string;
  /** One line, plain language — shown on hover and under the badge. */
  description: string;
};

export const SESSION_TYPES: Record<string, SessionTypeInfo> = {
  EASY: {
    label: "Fácil",
    description: "Ritmo confortável, em que consegues falar. Constrói a base aeróbica.",
  },
  LONG: {
    label: "Longo",
    description: "A sessão mais longa da semana, a ritmo controlado. Treina a resistência.",
  },
  TEMPO: {
    label: "Tempo",
    description: "Ritmo forte mas sustentável, perto do limiar. Ensina o corpo a aguentar mais tempo a ritmo elevado.",
  },
  INTERVALS: {
    label: "Intervalos",
    description: "Repetições curtas e intensas com recuperação entre elas. Desenvolve a potência aeróbica.",
  },
  RECOVERY: {
    label: "Recuperação",
    description: "Curto e muito leve. Serve para recuperar, não para treinar — resistir à tentação de acelerar faz parte.",
  },
  STRENGTH: {
    label: "Força",
    description: "Colinas, acelerações e exercícios técnicos. Trabalha a mecânica e a força específica.",
  },
  BRICK: {
    label: "Brick",
    description: "Bicicleta seguida de corrida, sem pausa. Treina a transição e o correr com as pernas pesadas — o que acontece em prova.",
  },
  SWIM: {
    label: "Natação",
    description: "Sessão de piscina ou águas abertas, normalmente com foco técnico.",
  },
  RACE: {
    label: "Prova",
    description: "O dia do evento, ou uma simulação a ritmo de prova.",
  },
};

export function sessionTypeLabel(type: string): string {
  return SESSION_TYPES[type]?.label ?? type;
}

export function sessionTypeDescription(type: string): string | null {
  return SESSION_TYPES[type]?.description ?? null;
}
