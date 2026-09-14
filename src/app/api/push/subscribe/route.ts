export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const athlete = await prisma.athlete.findUnique({ where: { userId } });
  if (!athlete) return NextResponse.json({ error: "Atleta não encontrado" }, { status: 404 });

  const { subscription } = await req.json();
  if (!subscription) return NextResponse.json({ error: "Subscription inválida" }, { status: 400 });

  await prisma.athlete.update({
    where: { id: athlete.id },
    data: { pushSubscription: subscription },
  });

  return NextResponse.json({ ok: true });
}
