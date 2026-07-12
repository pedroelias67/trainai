export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
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
      user: true,
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

  return NextResponse.json(athlete);
}
