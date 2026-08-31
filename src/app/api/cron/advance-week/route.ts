export const dynamic = "force-dynamic";
// Tops up the plan horizon, which calls Claude once per plan that needs it.
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as Sentry from "@sentry/nextjs";
import { startOfWeek, differenceInWeeks } from "date-fns";
import { topUpPlanHorizon } from "@/lib/plan-horizon";

// Leaves room within the 300s limit to finish the plan in progress.
const BUDGET_MS = 200_000;

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

    // Keep the horizon ahead of the athlete. Advancing the week is cheap and
    // must happen for every plan, so it runs above the budget check; only the
    // model call is deferred when time runs short.
    if (Date.now() - startedAt > BUDGET_MS) {
      restantes = true;
      continue;
    }
    try {
      const criadas = await topUpPlanHorizon(plan.id);
      extended += criadas.length;
    } catch (err) {
      // The athlete still has the weeks already written; this retries next week,
      // and opening a session fetches its detail regardless.
      console.error("Horizon top-up failed:", err);
      Sentry.captureException(err, {
        tags: { job: "advance-week", stage: "horizon" },
        extra: { planId: plan.id },
      });
    }
  }

  return NextResponse.json({ updated, extended, restantes, total: activePlans.length });
}
