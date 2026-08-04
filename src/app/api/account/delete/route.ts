import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("user_id")?.value;
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  // Delete in dependency order — Prisma cascades handle most, but explicit order is safer
  await prisma.$transaction([
    prisma.personalRecord.deleteMany({ where: { athlete: { userId } } }),
    prisma.shoe.deleteMany({ where: { athlete: { userId } } }),
    prisma.weeklyReport.deleteMany({ where: { athlete: { userId } } }),
    prisma.activity.deleteMany({ where: { athlete: { userId } } }),
    prisma.trainingSession.deleteMany({ where: { week: { plan: { athlete: { userId } } } } }),
    prisma.trainingWeek.deleteMany({ where: { plan: { athlete: { userId } } } }),
    prisma.trainingPlan.deleteMany({ where: { athlete: { userId } } }),
    prisma.nutritionPlan.deleteMany({ where: { athlete: { userId } } }),
    prisma.event.deleteMany({ where: { athlete: { userId } } }),
    prisma.athlete.deleteMany({ where: { userId } }),
    prisma.session.deleteMany({ where: { userId } }),
    prisma.account.deleteMany({ where: { userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);

  // Clear session cookie
  const response = NextResponse.json({ ok: true });
  response.cookies.delete("user_id");
  return response;
}
