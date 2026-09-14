export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const athlete = await prisma.athlete.findUnique({ where: { userId } });
  if (!athlete) return NextResponse.json({ error: "Atleta não encontrado" }, { status: 404 });

  const shoes = await prisma.shoe.findMany({
    where: { athleteId: athlete.id },
    orderBy: [{ retired: "asc" }, { createdAt: "desc" }],
    include: { _count: { select: { activities: true } } },
  });

  return NextResponse.json(shoes);
}

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const athlete = await prisma.athlete.findUnique({ where: { userId } });
  if (!athlete) return NextResponse.json({ error: "Atleta não encontrado" }, { status: 404 });

  const body = await req.json();
  const { name, brand, color, purchaseDate, distanceLimit } = body;

  if (!name) return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });

  const shoe = await prisma.shoe.create({
    data: {
      athleteId: athlete.id,
      name,
      brand: brand || null,
      color: color || null,
      purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
      distanceLimit: distanceLimit ? Number(distanceLimit) : 700,
    },
  });

  return NextResponse.json(shoe, { status: 201 });
}
