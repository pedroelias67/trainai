export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

async function getAthleteAndShoe(userId: string, shoeId: string) {
  const athlete = await prisma.athlete.findUnique({ where: { userId } });
  if (!athlete) return { error: "Atleta não encontrado", status: 404 };

  const shoe = await prisma.shoe.findUnique({ where: { id: shoeId } });
  if (!shoe || shoe.athleteId !== athlete.id) return { error: "Não autorizado", status: 403 };

  return { athlete, shoe };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const userId = cookieStore.get("user_id")?.value;
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  const result = await getAthleteAndShoe(userId, id);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (body.name != null) data.name = body.name;
  if (body.brand != null) data.brand = body.brand;
  if (body.color != null) data.color = body.color;
  if (body.retired != null) data.retired = Boolean(body.retired);
  if (body.distanceLimit != null) data.distanceLimit = Number(body.distanceLimit);

  const updated = await prisma.shoe.update({ where: { id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const userId = cookieStore.get("user_id")?.value;
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  const result = await getAthleteAndShoe(userId, id);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

  await prisma.shoe.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
