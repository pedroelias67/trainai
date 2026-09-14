export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { accountStatus, accountStatusSelect, requireAdmin } from "@/lib/admin";


export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { id } = await params;

  const athlete = await prisma.athlete.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true, createdAt: true, ...accountStatusSelect() } },
      events: { orderBy: { date: "asc" } },
      trainingPlans: {
        include: {
          event: true,
          weeks: {
            include: { sessions: true },
            orderBy: { weekNumber: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      activities: {
        orderBy: { date: "desc" },
        take: 20,
      },
    },
  });

  if (!athlete) {
    return NextResponse.json({ error: "Atleta não encontrado" }, { status: 404 });
  }

  // Third-party credentials never leave the server, admin or not: each one acts
  // on the athlete's own Strava or Intervals.icu account.
  const {
    stravaAccessToken: _sa, stravaRefreshToken: _sr, intervalsIcuApiKey: _ik, pushSubscription: _ps,
    user: { verificationToken: _vt, passwordHash: _ph, _count: _c, ...user },
    ...rest
  } = athlete;

  return NextResponse.json({
    ...rest,
    user: { ...user, ...accountStatus(athlete.user) },
    intervalsIcuConnected: !!athlete.intervalsIcuApiKey,
  });
}
