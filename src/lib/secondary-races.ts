// The races that are not the goal.
//
// An athlete rarely has one race in the diary. They have the one they are
// training for and two or three along the way — a 10K next month, a club half
// in six weeks. A plan that pretends those do not exist puts intervals on the
// Thursday before one and a long run on the morning of another.
//
// Event.priority has held A, B or C since the schema was first written and
// nothing ever read it. This is what reads it.
//
// What the two grades mean here:
//   B — a race that matters. The three days before it come down, the day after
//       is easy, and a long race takes that week's long run with it.
//   C — a race run as training. No taper at all; it stands in for that week's
//       hard session instead of being added on top of it.

import { prisma } from "@/lib/prisma";
import { RACE_KM } from "@/lib/race-distances";
import { weekVolumeFromRows } from "@/lib/week-volume";

export type RacePriority = "A" | "B" | "C";

export type SecondaryRace = {
  name: string;
  date: Date;
  distance: string;
  sport: string;
  priority: RacePriority;
};

/** A session as the skeleton carries it, before it becomes a row. */
export type SkeletonSession = {
  /**
   * The row this came from, when the caller is working on a plan that already
   * exists. Absent on a session this file invents, which is how the caller
   * tells a new race apart from one that was already there.
   */
  id?: string;
  dayOfWeek: number;
  sport: string;
  sessionType: string;
  name: string;
  plannedDistanceKm?: number | null;
  plannedDurationMin?: number | null;
  plannedPace?: string | null;
  isPriority?: boolean;
};

export type SkeletonWeek = {
  weekNumber: number;
  sessions: SkeletonSession[];
  totalDistanceKm?: number;
  totalDurationMin?: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
/** Sessions that ask something of the body beyond aerobic work. */
const HARD = new Set(["INTERVALS", "TEMPO"]);
/** How many days before a B race stop being training days. */
const DIAS_DE_ALIVIO = 3;
/** A race at least this fraction of the week's long run stands in for it. */
const SUBSTITUI_LONGO = 0.7;
/** What a hard session keeps when it is brought down to easy. */
const FACTOR_FACIL = 0.6;

const meiaNoite = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
};

/**
 * The calendar day, as the day the athlete runs it.
 *
 * Not toISOString(): west of Greenwich in summer that reads local midnight back
 * as the day before, so the prompt would name the Saturday for a race run on
 * the Sunday while the placement below used the right day.
 */
const diaCivil = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Where a race ended up, and what it moved. For telling the athlete. */
export type RacePlacement = {
  race: SecondaryRace;
  weekNumber: number;
  /** Plain sentences, in Portuguese, about what changed around it. */
  changes: string[];
};

type Datada = { date: number; session: SkeletonSession };

function sessaoDeProva(race: SecondaryRace): SkeletonSession {
  return {
    dayOfWeek: 1, // recomputed when the weeks are rebuilt
    sport: race.sport,
    sessionType: "RACE",
    name: race.name,
    plannedDistanceKm: RACE_KM[race.distance] ?? null,
    plannedDurationMin: null,
    plannedPace: null,
    isPriority: true,
  };
}

/** Brings a session down to easy, keeping the shape of the week. */
function aliviar(session: SkeletonSession, sufixo: string): SkeletonSession {
  const km = session.plannedDistanceKm;
  const min = session.plannedDurationMin;
  return {
    ...session,
    sessionType: "EASY",
    name: `Corrida Fácil ${sufixo}`,
    plannedDistanceKm: km ? Math.round(km * FACTOR_FACIL * 10) / 10 : km,
    plannedDurationMin: min ? Math.round(min * FACTOR_FACIL) : min,
    plannedPace: null,
    isPriority: false,
  };
}

/**
 * Puts each race on its date and settles the training around it.
 *
 * The prompt asks the model for the same thing; this is what holds it to it. A
 * race the athlete has entered must appear on the day it is run, and the days
 * around it must not contradict it — a plan is written once and trained for
 * weeks.
 *
 * Races outside the weeks given are left alone: the job that extends the plan
 * each week calls this again, and will reach them when their week exists.
 */
export function placeRaces<W extends SkeletonWeek>(
  weeks: W[],
  races: SecondaryRace[],
  planStart: Date
): { weeks: W[]; placed: RacePlacement[] } {
  if (weeks.length === 0 || races.length === 0) return { weeks, placed: [] };

  const inicio = meiaNoite(planStart);
  const numeros = new Set(weeks.map(w => w.weekNumber));

  const semanaDe = (date: number) => Math.floor((date - inicio) / (7 * DAY_MS)) + 1;

  // Flattened on to absolute dates: the days before a Monday race belong to the
  // week before, and week-by-week arithmetic gets that wrong.
  let plano: Datada[] = weeks.flatMap(w =>
    w.sessions.map(s => ({
      date: inicio + ((w.weekNumber - 1) * 7 + (s.dayOfWeek - 1)) * DAY_MS,
      session: s,
    }))
  );

  const placed: RacePlacement[] = [];

  for (const race of [...races].sort((a, b) => a.date.getTime() - b.date.getTime())) {
    const dia = meiaNoite(race.date);
    const semana = semanaDe(dia);
    if (semana < 1) continue;

    // The plan is written in batches, so a race can sit outside the weeks in
    // hand while what it asks for falls inside them — a Sunday race wants the
    // Monday after it easy, and that Monday belongs to the next batch. The race
    // itself is only added to a week that is here; what it asks of neighbouring
    // days is done wherever those days happen to be.
    const temSemana = numeros.has(semana);

    const changes: string[] = [];
    // A second race marked A cannot have a second peak built for it; the plan
    // has one goal. It is prepared as a B and the athlete is told so.
    const grau: RacePriority = race.priority === "A" ? "B" : race.priority;
    if (race.priority === "A" && temSemana) {
      changes.push("Marcada como prova A, mas o plano já tem um objetivo principal — preparada como prova B.");
    }

    // A race already standing on its own day is this race, put there by an
    // earlier pass. Treating it as an occupant to be displaced is how the same
    // race came to be entered twice: the first one cancelled, a second created,
    // and both left on the athlete's watch on the morning of the race.
    const jaColocada = plano.some(p => p.date === dia && p.session.sessionType === "RACE");

    if (temSemana && !jaColocada) {
      const substituidas = plano.filter(p => p.date === dia);
      plano = plano.filter(p => p.date !== dia);
      if (substituidas.length > 0) {
        changes.push(`No dia da prova saiu ${substituidas.map(p => p.session.name).join(" e ")}.`);
      }
      plano.push({ date: dia, session: sessaoDeProva(race) });
    }

    if (grau === "B") {
      for (let d = 1; d <= DIAS_DE_ALIVIO; d++) {
        const antes = dia - d * DAY_MS;
        const naquele = plano.filter(p => p.date === antes);
        if (naquele.length === 0) continue;

        if (d === 1) {
          plano = plano.filter(p => p.date !== antes);
          changes.push(`Véspera livre: saiu ${naquele.map(p => p.session.name).join(" e ")}.`);
          continue;
        }
        for (const p of naquele) {
          if (!HARD.has(p.session.sessionType) && p.session.sessionType !== "LONG") continue;
          p.session = aliviar(p.session, "(pré-prova)");
          changes.push(`${d} dias antes: ${p.session.name}, em vez de trabalho duro.`);
        }
      }

      const depois = dia + DAY_MS;
      for (const p of plano.filter(p => p.date === depois)) {
        if (p.session.sessionType === "RECOVERY") continue;
        // Shortened as well as renamed. Calling an unchanged 8 km base run
        // "recovery" the morning after a race only makes the label a lie.
        const km = p.session.plannedDistanceKm;
        const min = p.session.plannedDurationMin;
        p.session = {
          ...p.session,
          sessionType: "RECOVERY",
          name: "Recuperação (pós-prova)",
          plannedDistanceKm: km ? Math.round(km * FACTOR_FACIL * 10) / 10 : km,
          plannedDurationMin: min ? Math.round(min * FACTOR_FACIL) : min,
          plannedPace: null,
          isPriority: false,
        };
        changes.push(`O dia seguinte passou a recuperação${km ? `, ${Math.round(km * FACTOR_FACIL * 10) / 10} km` : ""}.`);
      }

      // A long race is the week's long run; keeping both would double it.
      const kmProva = RACE_KM[race.distance] ?? 0;
      const longos = temSemana
        ? plano.filter(p => semanaDe(p.date) === semana && p.session.sessionType === "LONG" && p.date !== dia)
        : [];
      for (const longo of longos) {
        const kmLongo = longo.session.plannedDistanceKm ?? 0;
        if (kmLongo === 0 || kmProva < kmLongo * SUBSTITUI_LONGO) continue;
        plano = plano.filter(p => p !== longo);
        changes.push(`A prova faz de longo desta semana: saiu ${longo.session.name} de ${kmLongo} km.`);
      }
    }

    if (grau === "C") {
      // It stands in for the week's hard session rather than being added to it.
      //
      // The one nearest the race goes, not the hardest: with intervals on the
      // Wednesday and a tempo on the Friday before a Sunday race, dropping the
      // intervals leaves two hard days in three. Dropping the Friday leaves the
      // week properly spaced.
      const duras = (temSemana ? plano.filter(p => semanaDe(p.date) === semana && HARD.has(p.session.sessionType)) : [])
        .sort(
          (a, b) =>
            Math.abs(a.date - dia) - Math.abs(b.date - dia) ||
            (a.session.sessionType === "INTERVALS" ? 0 : 1) - (b.session.sessionType === "INTERVALS" ? 0 : 1)
        );
      if (duras.length > 0) {
        const sai = duras[0];
        plano = plano.filter(p => p !== sai);
        changes.push(`A prova conta como o treino duro da semana: saiu ${sai.session.name}.`);
      }
      // No taper, but not a hard session on the eve either.
      const vespera = plano.filter(p => p.date === dia - DAY_MS && HARD.has(p.session.sessionType));
      for (const p of vespera) {
        p.session = aliviar(p.session, "(véspera)");
        changes.push(`Na véspera: ${p.session.name}.`);
      }
    }

    // A race outside these weeks that changed nothing in them is not reported:
    // the batch that holds it will report it.
    if (temSemana || changes.length > 0) placed.push({ race, weekNumber: semana, changes });
  }

  // Back into weeks, with the day of the week and the totals recomputed.
  const porSemana = new Map<number, Datada[]>();
  for (const p of plano) {
    const n = semanaDe(p.date);
    if (!porSemana.has(n)) porSemana.set(n, []);
    porSemana.get(n)!.push(p);
  }

  const refeitas = weeks.map(w => {
    const suas = (porSemana.get(w.weekNumber) ?? []).sort((a, b) => a.date - b.date);
    const sessions = suas.map(p => ({
      ...p.session,
      dayOfWeek: Math.round((p.date - (inicio + (w.weekNumber - 1) * 7 * DAY_MS)) / DAY_MS) + 1,
    }));
    // The week keeps whatever else it carries — its focus, the coach's message.
    return {
      ...w,
      sessions,
      totalDistanceKm: Math.round(sessions.reduce((s, x) => s + (x.plannedDistanceKm ?? 0), 0) * 10) / 10,
      totalDurationMin: sessions.reduce((s, x) => s + (x.plannedDurationMin ?? 0), 0),
    } as W;
  });

  return { weeks: refeitas, placed };
}

/**
 * The athlete's other races inside a plan's span.
 *
 * The plan's own event is left out — that is the goal, not a race along the way
 * — and so is anything on or after its date, which cannot be prepared for
 * inside this plan and would only crowd the prompt.
 */
export async function otherRacesInPlan(
  athleteId: string,
  targetEventId: string,
  from: Date,
  targetDate: Date
): Promise<SecondaryRace[]> {
  const eventos = await prisma.event.findMany({
    where: {
      athleteId,
      id: { not: targetEventId },
      date: { gte: from, lt: targetDate },
    },
    orderBy: { date: "asc" },
    select: { name: true, date: true, distance: true, sport: true, priority: true },
  });
  return eventos.map(e => ({
    name: e.name,
    date: e.date,
    distance: e.distance,
    sport: e.sport,
    priority: e.priority as RacePriority,
  }));
}

/**
 * What to tell the weekly adaptation about a race in the week it is adjusting.
 *
 * The adaptation rewrites next week's sessions from how the last one went. Left
 * to itself it would lengthen the easy day before a race because the athlete
 * trained well, or convert the race to an easy run because they were tired.
 */
export function upcomingRaceGuidance(races: SecondaryRace[]): string {
  if (races.length === 0) return "";
  return [
    "PROVAS MARCADAS NESTA SEMANA:",
    ...races.map(r => `- ${diaCivil(r.date)} — ${r.name}, prioridade ${r.priority}`),
    'Uma sessão do tipo RACE é a própria prova: devolve sempre "keep" para ela — não se encurta,',
    "não se converte e não se adia.",
    "Os dias antes de uma prova B estão de propósito aliviados. Não lhes aumentes volume nem",
    "intensidade, mesmo que a semana anterior tenha corrido bem.",
    "Uma prova C já ocupa o lugar do treino duro da semana. Não acrescentes outro.",
  ].join("\n");
}

/** What to tell the model about the races that are not the goal. */
export function secondaryRaceGuidance(races: SecondaryRace[]): string {
  if (races.length === 0) return "";

  const linhas = races.map(r => {
    const km = RACE_KM[r.distance];
    return `- ${diaCivil(r.date)} — ${r.name} (${r.distance}${km ? `, ${km} km` : ""}), prioridade ${r.priority}`;
  });

  return [
    "OUTRAS PROVAS NO CALENDÁRIO (não são o objetivo principal):",
    ...linhas,
    "Como tratá-las:",
    "- PROVA B: importa, quer-se um bom resultado. Os três dias anteriores aliviam — véspera de",
    "  descanso, e nada de intervalos ou tempo nos dois dias antes disso. O dia seguinte é de",
    "  recuperação. Se a prova for longa, é ela o treino longo dessa semana.",
    "- PROVA C: corre-se como treino, sem aliviar nada. Ocupa o lugar do treino duro dessa semana —",
    "  não se acrescenta a ele. Nada de qualidade na véspera.",
    "- Em qualquer dos casos, a prova aparece como sessão RACE no dia exato em que se corre, e a",
    "  progressão para o objetivo principal não é interrompida por ela.",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Applying all this to a plan that already exists.
//
// The placement above runs when a plan is written. But a race is usually
// entered later — the athlete signs up for a 10K in three weeks, inside weeks
// that were written a month ago. Without this, nothing would happen until the
// plan was regenerated, and regenerating to add a race is exactly the trade the
// rest of this project has been trying to remove.
// ---------------------------------------------------------------------------

export type ApplyResult = {
  created: number;
  cancelled: number;
  updated: number;
  /** Weeks whose sessions changed, for the caller to put back on the watch. */
  weekIds: string[];
  placed: RacePlacement[];
};

/** Fields whose change is worth writing back. */
function mudou(antes: SkeletonSession, depois: SkeletonSession): boolean {
  return (
    antes.sessionType !== depois.sessionType ||
    antes.name !== depois.name ||
    (antes.plannedDistanceKm ?? null) !== (depois.plannedDistanceKm ?? null) ||
    (antes.plannedDurationMin ?? null) !== (depois.plannedDurationMin ?? null) ||
    (antes.plannedPace ?? null) !== (depois.plannedPace ?? null)
  );
}

/**
 * Settles a live plan around the athlete's other races.
 *
 * Only what is still ahead is touched: a session already trained, or due today,
 * is history and stays as it is. A session the races displace is cancelled
 * rather than deleted, the same as when training days change, so the plan still
 * shows what it once asked for.
 */
export async function applyRacesToPlan(athleteId: string, planId: string): Promise<ApplyResult> {
  const vazio: ApplyResult = { created: 0, cancelled: 0, updated: 0, weekIds: [], placed: [] };

  const plan = await prisma.trainingPlan.findFirst({
    where: { id: planId, athleteId, status: "ACTIVE" },
    select: { id: true, eventId: true, startDate: true, event: { select: { date: true } } },
  });
  if (!plan) return vazio;

  const fimDeHoje = new Date();
  fimDeHoje.setHours(23, 59, 59, 999);

  const races = await otherRacesInPlan(athleteId, plan.eventId, fimDeHoje, plan.event.date);
  if (races.length === 0) return vazio;

  const semanas = await prisma.trainingWeek.findMany({
    where: { planId: plan.id },
    orderBy: { weekNumber: "asc" },
    select: {
      id: true, weekNumber: true, startDate: true,
      sessions: {
        where: { date: { gt: fimDeHoje }, cancelled: false },
        orderBy: { date: "asc" },
        select: {
          id: true, dayOfWeek: true, sport: true, sessionType: true, name: true,
          plannedDistance: true, plannedDuration: true, plannedPace: true, isPriority: true,
        },
      },
    },
  });
  if (semanas.length === 0) return vazio;

  const antesPorSemana = new Map(
    semanas.map(w => [
      w.weekNumber,
      w.sessions.map(s => ({
        id: s.id,
        dayOfWeek: s.dayOfWeek,
        sport: s.sport,
        sessionType: s.sessionType,
        name: s.name,
        plannedDistanceKm: s.plannedDistance,
        plannedDurationMin: s.plannedDuration,
        plannedPace: s.plannedPace,
        isPriority: s.isPriority,
      })) as SkeletonSession[],
    ])
  );

  const entrada = semanas.map(w => ({
    weekNumber: w.weekNumber,
    sessions: antesPorSemana.get(w.weekNumber)!,
  }));

  const { weeks: depois, placed } = placeRaces(entrada, races, plan.startDate);

  const resultado: ApplyResult = { created: 0, cancelled: 0, updated: 0, weekIds: [], placed };

  for (const semana of semanas) {
    const antes = antesPorSemana.get(semana.weekNumber) ?? [];
    const agora = depois.find(w => w.weekNumber === semana.weekNumber)?.sessions ?? [];
    const porId = new Map(agora.filter(s => s.id).map(s => [s.id!, s]));
    let mexeu = false;

    for (const velha of antes) {
      const nova = velha.id ? porId.get(velha.id) : undefined;
      if (!nova) {
        await prisma.trainingSession.update({ where: { id: velha.id! }, data: { cancelled: true } });
        resultado.cancelled++;
        mexeu = true;
        continue;
      }
      if (!mudou(velha, nova)) continue;
      await prisma.trainingSession.update({
        where: { id: velha.id! },
        data: {
          sessionType: nova.sessionType as never,
          name: nova.name,
          plannedDistance: nova.plannedDistanceKm ?? null,
          plannedDuration: nova.plannedDurationMin ?? null,
          plannedPace: nova.plannedPace ?? null,
          isPriority: nova.isPriority ?? false,
          // The prose describes a session that no longer exists; it is written
          // again when the athlete opens it.
          shortDescription: null, warmup: null, mainSet: null, cooldown: null,
          coachTip: null, rpe: null, keyFocus: null,
        },
      });
      resultado.updated++;
      mexeu = true;
    }

    for (const nova of agora.filter(s => !s.id)) {
      const date = new Date(semana.startDate);
      date.setDate(date.getDate() + nova.dayOfWeek - 1);
      await prisma.trainingSession.create({
        data: {
          weekId: semana.id,
          dayOfWeek: nova.dayOfWeek,
          date,
          sport: nova.sport as never,
          sessionType: nova.sessionType as never,
          name: nova.name,
          plannedDistance: nova.plannedDistanceKm ?? null,
          plannedDuration: nova.plannedDurationMin ?? null,
          plannedPace: nova.plannedPace ?? null,
          isPriority: nova.isPriority ?? true,
        },
      });
      resultado.created++;
      mexeu = true;
    }

    if (!mexeu) continue;
    resultado.weekIds.push(semana.id);

    // Read back rather than summing `agora`, which holds only the sessions
    // still ahead: a week whose Monday had already been trained came out
    // missing that Monday, and the athlete saw a week that had shrunk.
    const restantes = await prisma.trainingSession.findMany({
      where: { weekId: semana.id, cancelled: false },
      select: { plannedDistance: true, plannedDuration: true },
    });
    const volume = weekVolumeFromRows(restantes);
    await prisma.trainingWeek.update({
      where: { id: semana.id },
      data: { totalDistance: volume.km, totalDuration: volume.minutes },
    });
  }

  return resultado;
}
