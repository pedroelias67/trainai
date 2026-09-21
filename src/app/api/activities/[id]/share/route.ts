export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

const BASE_URL = process.env.NEXTAUTH_URL ?? "https://trainai.pedroelias.com";

/** The athlete's own activity, or null. */
async function ownActivity(id: string) {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const athlete = await prisma.athlete.findUnique({ where: { userId }, select: { id: true } });
  if (!athlete) return null;
  const activity = await prisma.activity.findUnique({
    where: { id },
    select: { id: true, athleteId: true, shareToken: true },
  });
  return activity && activity.athleteId === athlete.id ? { activity, athleteId: athlete.id } : null;
}

/**
 * Publishes an activity at an unguessable address that opens without an account.
 *
 * Sharing used to hand out the link to the athlete's own page, which asks for a
 * sign-in and then checks the activity belongs to whoever signed in — so the
 * person on the other end could create an account and still be told the workout
 * does not exist.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owned = await ownActivity(id);
  if (!owned) return NextResponse.json({ error: "Treino não encontrado" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (typeof body?.trimMap === "boolean") {
    await prisma.athlete.update({
      where: { id: owned.athleteId },
      data: { shareTrimMap: body.trimMap },
    });
  }

  // Keep an existing token: a link already sent to someone should keep working.
  const shareToken = owned.activity.shareToken ?? crypto.randomBytes(9).toString("base64url");
  if (!owned.activity.shareToken) {
    await prisma.activity.update({
      where: { id },
      data: { shareToken, sharedAt: new Date() },
    });
  }

  return NextResponse.json({ url: `${BASE_URL}/t/${shareToken}` });
}

/** Takes it down. The address stops working for everyone who has it. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owned = await ownActivity(id);
  if (!owned) return NextResponse.json({ error: "Treino não encontrado" }, { status: 404 });

  await prisma.activity.update({ where: { id }, data: { shareToken: null, sharedAt: null } });
  return NextResponse.json({ ok: true });
}
