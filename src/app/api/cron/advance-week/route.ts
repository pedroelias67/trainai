export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { startOfWeek, differenceInWeeks } from "date-fns";

// Called by Vercel Cron every Monday at 00:01
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const activePlans = await prisma.trainingPlan.findMany({
    where: { status: "ACTIVE" },
  });

  let updated = 0;

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

    // Archive plan if past end date
    if (new Date() > new Date(plan.endDate)) {
      await prisma.trainingPlan.update({
        where: { id: plan.id },
        data: { status: "ARCHIVED" },
      });
    }
  }

  return NextResponse.json({ updated, total: activePlans.length });
}
