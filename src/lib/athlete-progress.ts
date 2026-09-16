// Where each athlete stands between registering and training, and whether they
// are stuck there.
//
// Everyone who signs up passes through the same steps: fill in the profile, name
// a race, generate a plan, then train. Someone who stops halfway looks exactly
// like someone who has just started, and nothing told the admin which is which —
// so the person who needed a message never got one.

export type Stage = "conta" | "perfil" | "evento" | "plano" | "a-treinar" | "parado";

export type ProgressFacts = {
  createdAt: Date;
  lastLoginAt: Date | null;
  /** Profile step done: the onboarding writes these and nothing else does. */
  hasProfile: boolean;
  eventCount: number;
  /** Plans of any status: an archived one still means they got that far. */
  planCount: number;
  hasActivePlan: boolean;
  activityCount: number;
  lastActivityAt: Date | null;
  /** Sessions planned for today or later on the active plan. */
  sessionsAhead: number;
};

export type Progress = {
  stage: Stage;
  label: string;
  /** Why they are stuck, when they are. */
  detail?: string;
  stuck: boolean;
};

/** How long a step can sit unfinished before it stops looking like progress. */
export const STUCK_DAYS = 2;
/** Someone with a plan who has not trained in this long has drifted away. */
export const IDLE_DAYS = 14;

/**
 * When sign-ins started being recorded. Before this, an empty lastLoginAt means
 * nobody was writing it down — not that the person never came back, which is
 * what it read as for accounts that had been using the app for weeks.
 */
export const LOGIN_TRACKING_SINCE = new Date("2026-09-14T22:00:00Z");

export type LastSeen = { known: false } | { known: true; at: Date | null };

export function lastSeen(f: Pick<ProgressFacts, "createdAt" | "lastLoginAt">): LastSeen {
  if (f.lastLoginAt) return { known: true, at: f.lastLoginAt };
  return f.createdAt < LOGIN_TRACKING_SINCE ? { known: false } : { known: true, at: null };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const daysSince = (date: Date, now: Date) => (now.getTime() - date.getTime()) / DAY_MS;

/**
 * Whether to send someone to the onboarding when they sign in.
 *
 * The old test — "does the athlete have a fitness level" — was always true: the
 * column has a default, and registration creates the row. Everyone landed on an
 * empty dashboard, including the people who had never set anything up.
 */
export function needsOnboarding(f: Pick<ProgressFacts, "eventCount" | "planCount">): boolean {
  return f.eventCount === 0 && f.planCount === 0;
}

export function athleteProgress(f: ProgressFacts, now = new Date()): Progress {
  const waiting = daysSince(f.createdAt, now) > STUCK_DAYS;

  if (!f.hasProfile && f.eventCount === 0) {
    return {
      stage: "conta",
      label: "Conta criada",
      detail: lastSeen(f).known && !f.lastLoginAt
        ? "Nunca entrou depois do registo"
        : "Não preencheu o perfil",
      stuck: waiting,
    };
  }

  if (f.eventCount === 0) {
    return { stage: "perfil", label: "Perfil preenchido", detail: "Sem prova escolhida", stuck: waiting };
  }

  if (f.planCount === 0) {
    // They asked for a plan and did not get one: generation failed, or timed out.
    return {
      stage: "evento",
      label: "Prova escolhida",
      detail: "Plano não chegou a ser gerado",
      stuck: true,
    };
  }

  if (f.activityCount === 0) {
    return {
      stage: "plano",
      label: "Plano criado",
      detail: "Ainda não chegou nenhum treino",
      stuck: daysSince(f.createdAt, now) > STUCK_DAYS,
    };
  }

  if (f.lastActivityAt && daysSince(f.lastActivityAt, now) > IDLE_DAYS) {
    return {
      stage: "parado",
      label: "Parou de treinar",
      detail: `Último treino há ${Math.floor(daysSince(f.lastActivityAt, now))} dias`,
      stuck: true,
    };
  }

  // Training, but the plan has run out from under them: the rolling horizon
  // materialises a few weeks at a time, and an empty one looks like a bug.
  if (f.hasActivePlan && f.sessionsAhead === 0) {
    return { stage: "a-treinar", label: "A treinar", detail: "Plano sem treinos à frente", stuck: true };
  }

  return { stage: "a-treinar", label: "A treinar", stuck: false };
}

/** Stuck first, then in order of how far along they are. */
export const STAGE_ORDER: Stage[] = ["conta", "perfil", "evento", "plano", "parado", "a-treinar"];
