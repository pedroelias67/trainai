export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const userId = cookieStore.get("user_id")?.value;
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { athleteId, title, body, url } = await req.json();

  // Return the subscriptions so the client can trigger notifications
  if (athleteId) {
    const athlete = await prisma.athlete.findUnique({
      where: { id: athleteId },
      select: { pushSubscription: true },
    });
    return NextResponse.json({ subscription: athlete?.pushSubscription, title, body, url });
  }

  // All athletes
  const athletes = await prisma.athlete.findMany({
    where: { NOT: { pushSubscription: { equals: Prisma.JsonNull } } },
    select: { id: true, pushSubscription: true },
  });

  return NextResponse.json({
    count: athletes.length,
    subscriptions: athletes.map(a => a.pushSubscription),
    title,
    body,
    url,
  });
}
