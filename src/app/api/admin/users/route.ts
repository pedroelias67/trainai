export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { accountStatus, accountStatusSelect, requireAdmin } from "@/lib/admin";

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  // An explicit select: returning whole rows sent every user's password hash and
  // confirmation and reset tokens to the browser.
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      ...accountStatusSelect,
      athlete: {
        select: {
          id: true,
          fitnessLevel: true,
          stravaConnected: true,
          trainingPlans: { where: { status: "ACTIVE" }, select: { id: true }, take: 1 },
          _count: { select: { activities: true } },
        },
      },
    },
  });

  return NextResponse.json(
    users.map(({ emailVerified, verificationToken, failedLoginCount, lockedUntil, lastLoginAt, passwordHash, ...u }) => ({
      ...u,
      status: accountStatus({ emailVerified, verificationToken, failedLoginCount, lockedUntil, lastLoginAt, passwordHash }),
    }))
  );
}
