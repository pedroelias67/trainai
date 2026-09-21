// Putting a training week on the athlete's watch.
//
// This used to happen only when someone found the button on the plan page and
// pressed it, week after week. Connecting Intervals.icu is the athlete saying
// they want their workouts on their watch; remembering to press a button every
// Sunday is not part of that bargain. So the plan sends itself whenever it
// changes, and the button stays as a way to force it.

import { prisma } from "@/lib/prisma";
import {
  buildCalendarEvent, deleteEventsForSessions, inferThresholdPace, replaceEvents,
} from "@/lib/intervals-icu";
import {
  checkWeekOnCalendar, recordIntervalsPush, recordWeekOnCalendar,
} from "@/lib/intervals-connection";

export type WatchSendResult =
  | {
      status: "sent";
      count: number;
      /** The pace the week's zones were converted against, for the caller to explain. */
      thresholdSecPerKm: number | null;
      hasRunning: boolean;
    }
  | { status: "skipped"; reason: "not-connected" | "no-sessions" | "past-week" }
  | { status: "failed"; error: string };

/**
 * Sends one week's sessions, replacing whatever was there before.
 *
 * Never throws: every caller is doing something else that matters more — saving
 * an edit, finishing a plan — and a watch that missed an update is worth far
 * less than the work that triggered it.
 */
export async function sendWeekToWatch(athleteId: string, weekId: string): Promise<WatchSendResult> {
  try {
    const athlete = await prisma.athlete.findUnique({
      where: { id: athleteId },
      select: { id: true, intervalsIcuApiKey: true, intervalsIcuAthleteId: true, ltPace: true },
    });
    if (!athlete?.intervalsIcuApiKey || !athlete.intervalsIcuAthleteId) {
      return { status: "skipped", reason: "not-connected" };
    }

    const week = await prisma.trainingWeek.findFirst({
      where: { id: weekId, plan: { athleteId } },
      select: {
        endDate: true,
        planId: true,
        sessions: {
          where: { cancelled: false },
          orderBy: { date: "asc" },
          select: {
            id: true, name: true, sport: true, sessionType: true, date: true,
            plannedDuration: true, plannedPace: true,
            warmup: true, mainSet: true, cooldown: true, steps: true,
          },
        },
      },
    });
    if (!week) return { status: "skipped", reason: "no-sessions" };

    // A week that is over has already been trained; rewriting it on the calendar
    // would only disturb what the athlete has done.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (week.endDate < today) return { status: "skipped", reason: "past-week" };

    if (week.sessions.length === 0) return { status: "skipped", reason: "no-sessions" };

    // Read the reference pace from the whole plan, not just this week: a
    // recovery week's gentle paces imply a slower threshold, and the same zone
    // would then mean one pace this week and another the next.
    const planSessions = await prisma.trainingSession.findMany({
      where: { week: { planId: week.planId }, cancelled: false, sport: "RUNNING" },
      select: { sport: true, sessionType: true, plannedPace: true },
    });
    const threshold = inferThresholdPace(athlete.ltPace, planSessions.length > 0 ? planSessions : week.sessions);
    const events = week.sessions.map(s => buildCalendarEvent(s, threshold));
    const result = await replaceEvents(athlete.intervalsIcuApiKey, athlete.intervalsIcuAthleteId, events);

    if (!result.ok) {
      await recordIntervalsPush(athleteId, result.error);
      return { status: "failed", error: result.error };
    }

    await recordIntervalsPush(athleteId, null);
    await recordWeekOnCalendar(athleteId, await checkWeekOnCalendar(athlete));
    return {
      status: "sent",
      count: result.count,
      thresholdSecPerKm: threshold,
      hasRunning: week.sessions.some(s => s.sport === "RUNNING"),
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Erro inesperado";
    // Writing down the failure must not become a second failure.
    try {
      await recordIntervalsPush(athleteId, error);
    } catch {
      // Nothing left to do: the caller's own work is what matters here.
    }
    return { status: "failed", error };
  }
}

/** The week of a plan that covers today, or the first one still to come. */
export async function currentOrNextWeekId(planId: string): Promise<string | null> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const week = await prisma.trainingWeek.findFirst({
    where: { planId, endDate: { gte: today } },
    orderBy: { startDate: "asc" },
    select: { id: true },
  });
  return week?.id ?? null;
}

/**
 * Takes a plan's remaining workouts off the athlete's calendar.
 *
 * For when a plan stops being the one in force — archived, or replaced by a new
 * one for the same race. Without this its sessions stayed on the watch beside
 * the new plan's, two workouts a day, and the athlete had no way to tell which
 * was which. Past sessions are left: they are a record of what was trained.
 */
export async function removePlanFromWatch(athleteId: string, planId: string): Promise<number> {
  try {
    const athlete = await prisma.athlete.findUnique({
      where: { id: athleteId },
      select: { intervalsIcuApiKey: true, intervalsIcuAthleteId: true },
    });
    if (!athlete?.intervalsIcuApiKey || !athlete.intervalsIcuAthleteId) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sessions = await prisma.trainingSession.findMany({
      where: { week: { planId, plan: { athleteId } }, date: { gte: today } },
      select: { id: true, date: true },
      orderBy: { date: "asc" },
    });
    if (sessions.length === 0) return 0;

    return await deleteEventsForSessions(
      athlete.intervalsIcuApiKey,
      athlete.intervalsIcuAthleteId,
      sessions.map(s => s.id),
      sessions[0].date.toISOString().slice(0, 10),
      sessions[sessions.length - 1].date.toISOString().slice(0, 10)
    );
  } catch {
    // Archiving a plan must not fail because a calendar was unreachable.
    return 0;
  }
}
