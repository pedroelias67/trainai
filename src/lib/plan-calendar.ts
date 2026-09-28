// The grid a plan's weeks and sessions are hung on.
//
// Every date here is UTC midnight, and every step is taken with UTC methods.
// This used to be done with getDay/setDate/setHours, which read the clock of
// whatever machine happened to run the code. On Vercel that machine is in UTC
// and the plans came out right, so nothing ever showed — until a plan was
// generated from a laptop in Lisbon, where local midnight is 23:00 the day
// before. Every week then began an hour into Sunday: the weekly report looked
// for weeks starting on the Monday and found none, and the watch, which takes
// the calendar day from the timestamp, put Monday's session on Sunday.
//
// A plan's dates are a calendar, not an instant. They do not belong to a
// timezone, so they are all pinned to the one the server already used.

const DAY_MS = 24 * 60 * 60 * 1000;

/** The same calendar day, at UTC midnight. */
export function utcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * The Monday a plan starting today is anchored to.
 *
 * Mid-week, this is the Monday just gone: week one is the week under way, and
 * the days already past are dropped by the caller. On a Sunday it rolls
 * forward to tomorrow, because a plan whose first week is one day long helps
 * nobody.
 */
export function planStartFrom(today: Date): Date {
  const dia = today.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const paraSegunda = dia === 0 ? 1 : -(dia - 1);
  return new Date(utcMidnight(today).getTime() + paraSegunda * DAY_MS);
}

/** True when the plan starts on the coming Monday rather than the current week. */
export function startsNextWeek(today: Date): boolean {
  return today.getUTCDay() === 0;
}

/** Today's place in the week, on the same scale as a session: 1=Monday … 7=Sunday. */
export function todayDayOfWeek(today: Date): number {
  return today.getUTCDay() === 0 ? 7 : today.getUTCDay();
}

/** Where a week begins. Week numbers start at 1. */
export function weekStartFor(planStart: Date, weekNumber: number): Date {
  return new Date(utcMidnight(planStart).getTime() + (weekNumber - 1) * 7 * DAY_MS);
}

/** The last instant of a week that began here. */
export function weekEndFor(weekStart: Date): Date {
  return new Date(weekStart.getTime() + 7 * DAY_MS - 1);
}

/** The day a session falls on. `dayOfWeek` is 1=Monday … 7=Sunday. */
export function sessionDateFor(weekStart: Date, dayOfWeek: number): Date {
  return new Date(utcMidnight(weekStart).getTime() + (dayOfWeek - 1) * DAY_MS);
}
