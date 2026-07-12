export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "pedroelias67@gmail.com";

async function requireAdmin() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("user_id")?.value;
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.email !== ADMIN_EMAIL) return null;
  return user;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const [recentRegistrations, recentActivities, recentPlans] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { name: true, email: true, createdAt: true },
    }),
    prisma.activity.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        athlete: {
          include: { user: { select: { name: true, email: true } } },
        },
      },
    }),
    prisma.trainingPlan.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        athlete: {
          include: { user: { select: { name: true, email: true } } },
        },
        event: { select: { name: true } },
      },
    }),
  ]);

  type FeedItem = {
    type: "register" | "activity" | "plan";
    date: string;
    description: string;
    userName: string;
  };

  const items: FeedItem[] = [];

  for (const u of recentRegistrations) {
    items.push({
      type: "register",
      date: u.createdAt.toISOString(),
      description: `${u.name ?? u.email} criou uma conta`,
      userName: u.name ?? u.email,
    });
  }

  for (const a of recentActivities) {
    const userName = a.athlete.user.name ?? a.athlete.user.email;
    const km = a.distance != null ? ` (${Math.round((a.distance / 1000) * 10) / 10}km)` : "";
    items.push({
      type: "activity",
      date: a.createdAt.toISOString(),
      description: `${userName} sincronizou uma atividade${km}`,
      userName,
    });
  }

  for (const p of recentPlans) {
    const userName = p.athlete.user.name ?? p.athlete.user.email;
    items.push({
      type: "plan",
      date: p.createdAt.toISOString(),
      description: `${userName} criou um plano para ${p.event.name}`,
      userName,
    });
  }

  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return NextResponse.json(items.slice(0, 50));
}
