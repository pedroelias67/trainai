export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyApiKey } from "@/lib/intervals-icu";

/** Stores an Intervals.icu API key after checking it actually works. */
export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const userId = cookieStore.get("user_id")?.value;
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const athlete = await prisma.athlete.findUnique({ where: { userId }, select: { id: true } });
  if (!athlete) return NextResponse.json({ error: "Atleta não encontrado" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const apiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";
  if (!apiKey) return NextResponse.json({ error: "Chave em falta" }, { status: 400 });

  const account = await verifyApiKey(apiKey);
  if (!account) {
    return NextResponse.json(
      { error: "Chave inválida. Confirma em intervals.icu → Settings → Developer Settings." },
      { status: 400 }
    );
  }

  await prisma.athlete.update({
    where: { id: athlete.id },
    data: { intervalsIcuApiKey: apiKey, intervalsIcuAthleteId: account.id },
  });

  return NextResponse.json({ ok: true, athleteName: account.name });
}

/** Forgets the key, leaving anything already on the Intervals.icu calendar in place. */
export async function DELETE() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("user_id")?.value;
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  await prisma.athlete.update({
    where: { userId },
    data: { intervalsIcuApiKey: null, intervalsIcuAthleteId: null },
  });

  return NextResponse.json({ ok: true });
}
