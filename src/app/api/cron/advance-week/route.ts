export const dynamic = "force-dynamic";
// Tops up the plan horizon, which calls Claude once per plan that needs it.
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as Sentry from "@sentry/nextjs";
import { startOfWeek, differenceInWeeks, subDays } from "date-fns";
import { topUpPlanHorizon } from "@/lib/plan-horizon";

/** Nothing new is started after this, leaving room to finish the plan in hand. */
const BUDGET_MS = 280_000;
/** What the report catch-up is given. The report job stops itself at 240s. */
const CATCHUP_MS = 250_000;

// Called by Vercel Cron every Monday at 00:01
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const activePlans = await prisma.trainingPlan.findMany({ where: { status: "ACTIVE" } });

  let updated = 0;
  let extended = 0;
  let restantes = false;

  // Advancing the week and archiving what is over is pure database work and
  // must happen for every plan, so it all runs before anything that can be cut
  // short.
  const porEstender: string[] = [];
  for (const plan of activePlans) {
    const planStart = startOfWeek(new Date(plan.startDate), { weekStartsOn: 1 });
    const now = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weeksPassed = differenceInWeeks(now, planStart) + 1;
    const newCurrentWeek = Math.max(1, Math.min(weeksPassed, plan.totalWeeks));

    if (newCurrentWeek !== plan.currentWeek) {
      await prisma.trainingPlan.update({
        where: { id: plan.id },
        data: { currentWeek: newCurrentWeek },
      });
      updated++;
    }

    // Archive plan if past end date — nothing left to extend either.
    if (new Date() > new Date(plan.endDate)) {
      await prisma.trainingPlan.update({
        where: { id: plan.id },
        data: { status: "ARCHIVED" },
      });
      continue;
    }

    porEstender.push(plan.id);
  }

  // Sunday's report job stops when it runs out of time, and until now the
  // athletes it had not reached were simply dropped. This finishes that list,
  // for the week that ended last night.
  //
  // It goes before the horizon top-up, not after: someone is waiting for that
  // mail, nobody is waiting for a week to be written five weeks out, and when
  // this function is killed at 300s it takes the report job down with it. The
  // work that must not be interrupted goes first.
  let relatorios: unknown = "não tentado";
  try {
    const ontem = subDays(new Date(), 1);
    const url = `${process.env.NEXTAUTH_URL ?? "https://trainai.pedroelias.com"}/api/cron/weekly-report`
      + `?weekStart=${startOfWeek(ontem, { weekStartsOn: 1 }).toISOString().slice(0, 10)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
      // Awaited, unlike the self-call this replaces: aborting early is what
      // killed the invocation doing the work. The timeout only has to outlast
      // the report job's own budget.
      signal: AbortSignal.timeout(CATCHUP_MS),
    });
    relatorios = res.ok ? await res.json() : `HTTP ${res.status}`;
  } catch (err) {
    relatorios = err instanceof Error ? err.message : "erro";
    Sentry.captureException(err, { tags: { job: "advance-week", stage: "weekly-report-catchup" } });
  }

  // Keep the horizon ahead of the athlete. Only the model call is deferred when
  // time runs short; next Monday tries again, and opening a session fetches its
  // detail regardless.
  for (const planId of porEstender) {
    if (Date.now() - startedAt > BUDGET_MS) {
      restantes = true;
      break;
    }
    try {
      const criadas = await topUpPlanHorizon(planId);
      extended += criadas.length;
    } catch (err) {
      console.error("Horizon top-up failed:", err);
      Sentry.captureException(err, {
        tags: { job: "advance-week", stage: "horizon" },
        extra: { planId },
      });
    }
  }

  return NextResponse.json({ updated, extended, restantes, total: activePlans.length, relatorios });
}
