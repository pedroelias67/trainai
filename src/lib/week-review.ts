// Putting the week back together before anyone is asked to judge it.
//
// The app matches each activity to the session it belongs to as it arrives,
// and records the pairing — `completed`, and the activity's id on the session.
// The weekly analysis then threw all of that away and handed the model two
// separate lists: planned sessions with no dates, and activities with dates,
// to be matched by guesswork.
//
// It guessed wrong. An athlete who ran his 5x600m intervals on the Wednesday
// was told the intervals had not been done, and that his "easy run" that day
// had been run a minute per kilometre too fast. Both lists were right and the
// conclusion drawn from them was not, because the one fact that reconciled
// them — these are the same run — was never passed on.
//
// So the week is reconciled here, once, and all three callers send the same
// thing: each session with its day, what was asked, and what was actually run
// in its place.

const DIAS = [
  "domingo", "segunda-feira", "terça-feira", "quarta-feira",
  "quinta-feira", "sexta-feira", "sábado",
];

export type PlannedRow = {
  id: string;
  date: Date;
  sessionType: string;
  name: string;
  sport: string;
  plannedDistance: number | null;
  plannedDuration: number | null;
  plannedPace: string | null;
  completed: boolean;
  activityId: string | null;
};

export type ActivityRow = {
  id: string;
  date: Date;
  name: string | null;
  sport: string;
  distance: number | null;
  duration: number | null;
  avgHR: number | null;
  avgPace: string | null;
  trainingLoad: number | null;
};

export type DoneWork = {
  distanceKm?: number;
  durationMin?: number;
  avgPace?: string;
  avgHR?: number;
  trainingLoad?: number;
};

export type ReviewedSession = {
  /** "quarta-feira, 2026-11-18" — the day, because a plan is a calendar. */
  day: string;
  sessionType: string;
  name: string;
  sport: string;
  planned: { distanceKm?: number; durationMin?: number; pace?: string };
  /** What was run in its place, or null when the session was not done. */
  done: DoneWork | null;
};

export type ExtraActivity = DoneWork & { day: string; sport: string; name: string };

export type WeekReview = {
  sessions: ReviewedSession[];
  /** Training that matched no planned session. Not a failure — just unplanned. */
  extra: ExtraActivity[];
};

const dia = (d: Date) => `${DIAS[d.getUTCDay()]}, ${d.toISOString().slice(0, 10)}`;

function trabalho(a: ActivityRow): DoneWork {
  return {
    ...(a.distance != null ? { distanceKm: Math.round((a.distance / 1000) * 10) / 10 } : {}),
    ...(a.duration != null ? { durationMin: Math.round(a.duration / 60) } : {}),
    ...(a.avgPace ? { avgPace: a.avgPace } : {}),
    ...(a.avgHR != null ? { avgHR: a.avgHR } : {}),
    ...(a.trainingLoad != null ? { trainingLoad: a.trainingLoad } : {}),
  };
}

/** The week as it actually went, session by session, with the pairing kept. */
export function reviewWeek(sessions: PlannedRow[], activities: ActivityRow[]): WeekReview {
  const porId = new Map(activities.map(a => [a.id, a]));
  const usadas = new Set<string>();

  const revistas = [...sessions]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map(s => {
      const feita = s.activityId ? porId.get(s.activityId) : undefined;
      if (feita) usadas.add(feita.id);
      return {
        day: dia(s.date),
        sessionType: s.sessionType,
        name: s.name,
        sport: s.sport,
        planned: {
          ...(s.plannedDistance != null ? { distanceKm: s.plannedDistance } : {}),
          ...(s.plannedDuration != null ? { durationMin: s.plannedDuration } : {}),
          ...(s.plannedPace ? { pace: s.plannedPace } : {}),
        },
        // Completed without a linked activity still counts as done: the athlete
        // ticked it off, and calling it undone would contradict them.
        done: feita ? trabalho(feita) : s.completed ? {} : null,
      };
    });

  const extra = activities
    .filter(a => !usadas.has(a.id))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map(a => ({ day: dia(a.date), sport: a.sport, name: a.name ?? a.sport, ...trabalho(a) }));

  return { sessions: revistas, extra };
}

/** The reconciled week, written for the model. */
export function formatWeekReview(review: WeekReview): string {
  const feitas = review.sessions.filter(s => s.done !== null).length;

  const linhas = review.sessions.map(s => {
    const pedido = [
      s.planned.distanceKm != null ? `${s.planned.distanceKm} km` : null,
      s.planned.durationMin != null ? `${s.planned.durationMin} min` : null,
      s.planned.pace ?? null,
    ].filter(Boolean).join(", ");

    if (s.done === null) return `- ${s.day} — ${s.sessionType} "${s.name}": pedido ${pedido}. NÃO FEITO.`;

    const feito = [
      s.done.distanceKm != null ? `${s.done.distanceKm} km` : null,
      s.done.durationMin != null ? `${s.done.durationMin} min` : null,
      s.done.avgPace ?? null,
      s.done.avgHR != null ? `FC ${s.done.avgHR}` : null,
    ].filter(Boolean).join(", ");

    return `- ${s.day} — ${s.sessionType} "${s.name}": pedido ${pedido}. FEITO${feito ? `: ${feito}` : ""}.`;
  });

  const extras = review.extra.map(
    e => `- ${e.day} — ${e.name}: ${[
      e.distanceKm != null ? `${e.distanceKm} km` : null,
      e.avgPace ?? null,
      e.avgHR != null ? `FC ${e.avgHR}` : null,
    ].filter(Boolean).join(", ")}`
  );

  return [
    `A SEMANA, SESSÃO A SESSÃO (${feitas} de ${review.sessions.length} realizadas):`,
    ...linhas,
    "",
    "O emparelhamento entre o que foi pedido e o que foi corrido já está feito pela app, a partir",
    "do dia e da modalidade. Toma-o como certo: uma sessão marcada FEITO foi realizada, seja qual",
    "for o nome que o relógio deu à corrida. Não voltes a emparelhar pelas datas nem concluas que",
    "uma sessão não foi feita por o nome não coincidir.",
    extras.length > 0
      ? `\nTREINO FORA DO PLANO (não é incumprimento, é treino a mais):\n${extras.join("\n")}`
      : "",
  ].filter(Boolean).join("\n");
}
