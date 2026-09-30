// Turns what is recorded about an athlete's Strava and Intervals.icu links into a
// verdict the admin can act on: working, worth a look, broken, or not in use.

export type Level = "ok" | "warning" | "error" | "off";

export type LinkStatus = { level: Level; label: string; detail?: string };

/**
 * Which of the conditions below was found true.
 *
 * The admin reads about someone else ("Falta o ritmo de limiar") and the
 * athlete reads about themselves ("o teu relógio recebe os treinos sem ritmo").
 * Two vocabularies, but the same conditions — written once here, so the day one
 * of them changes the other cannot quietly disagree.
 */
export type IntervalsReason =
  | "not-connected"
  | "push-error"
  | "no-threshold"
  | "week-missing"
  | "week-on-calendar"
  | "never-sent"
  | "quiet"
  | "ok";

export type IntervalsVerdict = LinkStatus & { reason: IntervalsReason };

export type ConnectionFacts = {
  stravaConnected: boolean;
  stravaSyncError: string | null;
  stravaSyncErrorAt: Date | null;
  /** Start of the most recent activity on record, from any source. */
  lastActivityAt: Date | null;

  intervalsConnected: boolean;
  intervalsIcuLastPushAt: Date | null;
  intervalsIcuPushError: string | null;
  intervalsIcuHasRunThreshold: boolean | null;
  /** This week's sessions are on the Intervals.icu calendar. Null when unknown. */
  intervalsIcuWeekOnCalendar: boolean | null;

  /** Weekly sends only matter to someone following a plan. */
  hasActivePlan: boolean;
};

/** An athlete on a plan trains several times a week; a week of silence is worth a look. */
export const QUIET_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export function daysAgo(date: Date, now = new Date()): string {
  const days = Math.floor((now.getTime() - date.getTime()) / DAY_MS);
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  return `há ${days} dias`;
}

const daysSince = (date: Date, now: Date) => (now.getTime() - date.getTime()) / DAY_MS;

export function stravaStatus(f: ConnectionFacts, now = new Date()): LinkStatus {
  if (!f.stravaConnected) {
    // Disconnected by a revocation reads differently from never connected.
    if (f.stravaSyncError) {
      return {
        level: "error",
        label: "Ligação removida",
        detail: `${f.stravaSyncError}${f.stravaSyncErrorAt ? ` (${daysAgo(f.stravaSyncErrorAt, now)})` : ""}`,
      };
    }
    return { level: "warning", label: "Não ligado", detail: "Sem Strava a app não recebe atividades" };
  }

  if (f.stravaSyncError) {
    return {
      level: "error",
      label: "Falha a sincronizar",
      detail: `${f.stravaSyncError}${f.stravaSyncErrorAt ? ` (${daysAgo(f.stravaSyncErrorAt, now)})` : ""}`,
    };
  }

  if (!f.lastActivityAt) {
    return { level: "warning", label: "Ligado, sem atividades", detail: "Ainda não chegou nenhuma atividade" };
  }

  if (daysSince(f.lastActivityAt, now) > QUIET_DAYS) {
    return {
      level: "warning",
      label: `Sem atividades ${daysAgo(f.lastActivityAt, now)}`,
      detail: "Ou não tem treinado, ou as atividades deixaram de chegar",
    };
  }

  return { level: "ok", label: `Última atividade ${daysAgo(f.lastActivityAt, now)}` };
}

export function intervalsStatus(f: ConnectionFacts, now = new Date()): IntervalsVerdict {
  if (!f.intervalsConnected) return { reason: "not-connected", level: "off", label: "Não ligado" };

  if (f.intervalsIcuPushError) {
    return { reason: "push-error", level: "error", label: "Falha no envio", detail: f.intervalsIcuPushError };
  }

  // Everything else still works, which is what makes this one easy to miss: the
  // watch gets every workout, and none of them says how fast.
  if (f.intervalsIcuHasRunThreshold === false) {
    return {
      reason: "no-threshold",
      level: "warning",
      label: "Falta o ritmo de limiar",
      detail: "O relógio recebe os treinos sem alvos de ritmo",
    };
  }

  // What the calendar says beats any timestamp: a week sent before we started
  // recording sends is still on the watch.
  if (f.intervalsIcuWeekOnCalendar === false) {
    return { reason: "week-missing", level: "warning", label: "Semana atual por enviar", detail: "Estes treinos não estão no relógio" };
  }
  if (f.intervalsIcuWeekOnCalendar === true) {
    return { reason: "week-on-calendar", level: "ok", label: "Semana atual no relógio" };
  }

  if (f.hasActivePlan && !f.intervalsIcuLastPushAt) {
    return { reason: "never-sent", level: "warning", label: "Nenhuma semana enviada", detail: "O relógio pode não ter treinos da app" };
  }

  if (f.hasActivePlan && f.intervalsIcuLastPushAt && daysSince(f.intervalsIcuLastPushAt, now) > QUIET_DAYS) {
    return {
      reason: "quiet",
      level: "warning",
      label: `Último envio ${daysAgo(f.intervalsIcuLastPushAt, now)}`,
      detail: "A semana atual pode não estar no relógio",
    };
  }

  return {
    reason: "ok",
    level: "ok",
    label: f.intervalsIcuLastPushAt ? `Último envio ${daysAgo(f.intervalsIcuLastPushAt, now)}` : "Ligado",
    ...(f.intervalsIcuHasRunThreshold === null ? { detail: "Ritmo de limiar por verificar" } : {}),
  };
}

const RANK: Record<Level, number> = { error: 3, warning: 2, ok: 1, off: 0 };

export function worstLevel(...levels: Level[]): Level {
  return levels.reduce((a, b) => (RANK[b] > RANK[a] ? b : a), "off" as Level);
}

// ---------------------------------------------------------------------------
// The same diagnosis, said to the athlete.
//
// All of this was computed and then shown only on the admin page. So the app
// knew that someone's planned workouts were not reaching their watch, and told
// nobody but the administrator — while the athlete, whose activities were
// arriving through Strava and whose analysis looked healthy, had every reason
// to believe it was all working.
// ---------------------------------------------------------------------------

export type WatchNotice = {
  level: "warning" | "error";
  title: string;
  detail: string;
  action: { label: string; href: string; external?: boolean };
};

const PERFIL = { label: "Ligar o relógio", href: "/dashboard/profile" };
const PLANO = { label: "Abrir o plano", href: "/dashboard/plan" };
const DEFINICOES = {
  label: "Abrir definições do Intervals.icu",
  href: "https://intervals.icu/settings",
  external: true,
};

/**
 * What to tell the athlete about their workouts reaching their watch, or
 * nothing at all when there is nothing wrong.
 *
 * Silent for anyone without a plan in force: there are no workouts to deliver
 * yet, and a warning about a watch is noise before the first plan exists.
 */
export function watchNotice(f: ConnectionFacts, now = new Date()): WatchNotice | null {
  if (!f.hasActivePlan) return null;

  const { reason, detail } = intervalsStatus(f, now);

  switch (reason) {
    case "not-connected":
      return {
        level: "warning",
        title: "Os treinos não estão a chegar ao teu relógio",
        detail:
          "Tens um plano, mas falta ligar o Intervals.icu — é o que entrega os treinos ao relógio. " +
          "Faz-se uma vez e é gratuito.",
        action: PERFIL,
      };

    case "no-threshold":
      // The one that looks like everything is working. The workout arrives with
      // its steps; only the pace targets are missing, so the watch counts down
      // minutes and guides by heart rate instead.
      return {
        level: "warning",
        title: "O relógio recebe os treinos sem ritmo",
        detail:
          "Falta o Ritmo de Limiar nas definições de corrida do Intervals.icu. Sem ele, os alvos de " +
          "ritmo são descartados a caminho do relógio e cada fase aparece só com a duração.",
        action: DEFINICOES,
      };

    case "push-error":
      return {
        level: "error",
        title: "O último envio para o relógio falhou",
        detail: detail ?? "Não conseguimos entregar os treinos ao Intervals.icu.",
        action: PERFIL,
      };

    case "week-missing":
    case "never-sent":
      return {
        level: "warning",
        title: "A semana atual não está no relógio",
        detail: "Os treinos desta semana ainda não foram entregues. Podes enviá-los a partir do plano.",
        action: PLANO,
      };

    case "quiet":
      return {
        level: "warning",
        title: "Há uma semana que não se envia nada para o relógio",
        detail: "Os treinos desta semana podem não estar lá. Vale a pena confirmar.",
        action: PLANO,
      };

    default:
      return null;
  }
}
