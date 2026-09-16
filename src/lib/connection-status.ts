// Turns what is recorded about an athlete's Strava and Intervals.icu links into a
// verdict the admin can act on: working, worth a look, broken, or not in use.

export type Level = "ok" | "warning" | "error" | "off";

export type LinkStatus = { level: Level; label: string; detail?: string };

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

export function intervalsStatus(f: ConnectionFacts, now = new Date()): LinkStatus {
  if (!f.intervalsConnected) return { level: "off", label: "Não ligado" };

  if (f.intervalsIcuPushError) {
    return { level: "error", label: "Falha no envio", detail: f.intervalsIcuPushError };
  }

  // Everything else still works, which is what makes this one easy to miss: the
  // watch gets every workout, and none of them says how fast.
  if (f.intervalsIcuHasRunThreshold === false) {
    return {
      level: "warning",
      label: "Falta o ritmo de limiar",
      detail: "O relógio recebe os treinos sem alvos de ritmo",
    };
  }

  // What the calendar says beats any timestamp: a week sent before we started
  // recording sends is still on the watch.
  if (f.intervalsIcuWeekOnCalendar === false) {
    return { level: "warning", label: "Semana atual por enviar", detail: "Estes treinos não estão no relógio" };
  }
  if (f.intervalsIcuWeekOnCalendar === true) {
    return { level: "ok", label: "Semana atual no relógio" };
  }

  if (f.hasActivePlan && !f.intervalsIcuLastPushAt) {
    return { level: "warning", label: "Nenhuma semana enviada", detail: "O relógio pode não ter treinos da app" };
  }

  if (f.hasActivePlan && f.intervalsIcuLastPushAt && daysSince(f.intervalsIcuLastPushAt, now) > QUIET_DAYS) {
    return {
      level: "warning",
      label: `Último envio ${daysAgo(f.intervalsIcuLastPushAt, now)}`,
      detail: "A semana atual pode não estar no relógio",
    };
  }

  return {
    level: "ok",
    label: f.intervalsIcuLastPushAt ? `Último envio ${daysAgo(f.intervalsIcuLastPushAt, now)}` : "Ligado",
    ...(f.intervalsIcuHasRunThreshold === null ? { detail: "Ritmo de limiar por verificar" } : {}),
  };
}

const RANK: Record<Level, number> = { error: 3, warning: 2, ok: 1, off: 0 };

export function worstLevel(...levels: Level[]): Level {
  return levels.reduce((a, b) => (RANK[b] > RANK[a] ? b : a), "off" as Level);
}
