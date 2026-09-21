// Moving the sessions of a plan on to different days.
//
// Changing which days you can train used to mean regenerating the whole plan:
// the old one archived, a new one written from today as if you were starting
// over. For someone halfway through a block that throws away the progression
// they had built, to answer a question about the calendar. The sessions are
// fine; they are on the wrong days.

import { prisma } from "@/lib/prisma";
import { sendWeekToWatch } from "@/lib/watch-sync";

/** Hard days need space around them; the long run needs a day of its own. */
const HARD = new Set(["INTERVALS", "TEMPO"]);

/** What to keep when there are more sessions than days to put them on. */
const KEEP_PRIORITY: Record<string, number> = {
  RACE: 7, LONG: 6, INTERVALS: 5, TEMPO: 4, BRICK: 3, STRENGTH: 3, SWIM: 3, EASY: 2, RECOVERY: 1,
};

export type SessionToPlace = { id: string; sessionType: string; dayOfWeek: number };

export type Placement =
  | { id: string; dayOfWeek: number }
  | { id: string; dropped: true };

const priority = (t: string) => KEEP_PRIORITY[t] ?? 2;

/**
 * Places a week's sessions on the days the athlete can train, moving as little
 * as possible.
 *
 * A session already on a day that is still available stays there: changing one
 * day of the week should move one session, not reshuffle the whole week. From
 * that starting point the long run is put on its day, hard sessions are pulled
 * apart if they ended up adjacent, and anything left over fills the free days
 * in plan order. When there are fewer days than sessions, the least important
 * ones are dropped rather than crammed in.
 */
export function rescheduleWeek(
  sessions: SessionToPlace[],
  preferredDays: number[],
  longRunDay: number,
  /** Earliest day that may be used, for a week already under way. */
  fromDay = 1
): Placement[] {
  const days = [...new Set(preferredDays)].filter(d => d >= fromDay).sort((a, b) => a - b);
  const ordered = [...sessions].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  if (days.length === 0) return ordered.map(s => ({ id: s.id, dropped: true }));

  const keep = [...ordered]
    .sort((a, b) => priority(b.sessionType) - priority(a.sessionType) || a.dayOfWeek - b.dayOfWeek)
    .slice(0, days.length);
  const keepIds = new Set(keep.map(s => s.id));
  const dropped: Placement[] = ordered.filter(s => !keepIds.has(s.id)).map(s => ({ id: s.id, dropped: true }));
  const toPlace = ordered.filter(s => keepIds.has(s.id));

  const byDay = new Map<number, SessionToPlace>();
  const place = (session: SessionToPlace, day: number) => {
    for (const [d, s] of byDay) if (s.id === session.id) byDay.delete(d);
    byDay.set(day, session);
  };

  // The long run claims its day first, and may displace whoever is there.
  const long = toPlace.find(s => s.sessionType === "LONG" || s.sessionType === "RACE");
  const longDay = long ? (days.includes(longRunDay) ? longRunDay : days[days.length - 1]) : null;
  if (long && longDay !== null) place(long, longDay);

  // Everyone else keeps the day they already had, when it is still a training day.
  const undisturbed = new Set<string>();
  for (const session of toPlace) {
    if (session === long) continue;
    if (days.includes(session.dayOfWeek) && !byDay.has(session.dayOfWeek)) {
      place(session, session.dayOfWeek);
      undisturbed.add(session.id);
    }
  }

  // Then whoever was displaced, or whose day is gone, takes what is free.
  const freeDays = () => days.filter(d => !byDay.has(d));
  for (const session of toPlace) {
    if ([...byDay.values()].some(s => s.id === session.id)) continue;
    const free = freeDays();
    if (free.length > 0) place(session, free[0]);
  }

  // Finally, pull apart hard days that ended up together, or on the eve of the
  // long run — moving the hard session, never the long run.
  //
  // Only sessions this call had to move: a plan may already break these rules,
  // and repairing it while answering "I train on Fridays now" would move
  // sessions the athlete never asked about.
  for (const session of toPlace) {
    if (!HARD.has(session.sessionType) || undisturbed.has(session.id)) continue;
    const day = dayOf(byDay, session.id);
    if (day === null || !clashes(day, session.id, byDay, longDay)) continue;

    const better = days
      .filter(d => d !== longDay && !clashes(d, session.id, byDay, longDay))
      .sort((a, b) => Number(byDay.has(a)) - Number(byDay.has(b)) || a - b)[0];
    if (better === undefined) continue;

    const occupant = byDay.get(better);
    if (occupant && HARD.has(occupant.sessionType)) continue; // would only move the problem
    place(session, better);
    if (occupant) place(occupant, day);
  }

  return [
    ...toPlace.map(s => {
      const day = dayOf(byDay, s.id);
      return day === null ? { id: s.id, dropped: true as const } : { id: s.id, dayOfWeek: day };
    }),
    ...dropped,
  ];
}

function dayOf(byDay: Map<number, SessionToPlace>, id: string): number | null {
  for (const [day, session] of byDay) if (session.id === id) return day;
  return null;
}

/** A hard session on this day would sit next to another hard one, or the day before the long run. */
function clashes(
  day: number,
  id: string,
  byDay: Map<number, SessionToPlace>,
  longDay: number | null
): boolean {
  if (longDay !== null && day === longDay - 1) return true;
  for (const [d, s] of byDay) {
    if (s.id === id || !HARD.has(s.sessionType)) continue;
    if (Math.abs(d - day) === 1) return true;
  }
  return false;
}

export type RescheduleResult = { moved: number; dropped: number; weeks: number };

/**
 * Moves everything still to come in a plan on to the athlete's new days.
 *
 * Only the future is touched: a session already trained, or due today, stays
 * where it is. Each week is solved on its own, so the shape of every week —
 * its long run, its hard days — survives the move.
 */
export async function reschedulePlan(
  athleteId: string,
  planId: string,
  preferredDays: number[],
  longRunDay: number
): Promise<RescheduleResult> {
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const weeks = await prisma.trainingWeek.findMany({
    where: { planId, plan: { athleteId }, sessions: { some: { date: { gt: endOfToday }, cancelled: false } } },
    orderBy: { weekNumber: "asc" },
    select: {
      id: true, startDate: true,
      sessions: {
        where: { date: { gt: endOfToday }, cancelled: false },
        select: { id: true, sessionType: true, dayOfWeek: true },
      },
    },
  });

  let moved = 0;
  let dropped = 0;

  for (const week of weeks) {
    // In the week under way, only the days still ahead can be used.
    const weekStart = new Date(week.startDate);
    weekStart.setHours(0, 0, 0, 0);
    const daysIn = Math.floor((endOfToday.getTime() - weekStart.getTime()) / 86_400_000);
    const fromDay = daysIn >= 0 && daysIn < 7 ? Math.min(daysIn + 2, 7) : 1;

    for (const placement of rescheduleWeek(week.sessions, preferredDays, longRunDay, fromDay)) {
      if ("dropped" in placement) {
        await prisma.trainingSession.update({ where: { id: placement.id }, data: { cancelled: true } });
        dropped++;
        continue;
      }
      const current = week.sessions.find(s => s.id === placement.id);
      if (!current || current.dayOfWeek === placement.dayOfWeek) continue;

      const date = new Date(weekStart);
      date.setDate(date.getDate() + placement.dayOfWeek - 1);
      await prisma.trainingSession.update({
        where: { id: placement.id },
        data: { dayOfWeek: placement.dayOfWeek, date },
      });
      moved++;
    }

    // The watch is holding the old days.
    await sendWeekToWatch(athleteId, week.id);
  }

  return { moved, dropped, weeks: weeks.length };
}
