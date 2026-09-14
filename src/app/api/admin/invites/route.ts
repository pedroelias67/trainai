export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { accountStatus, accountStatusSelect, requireAdmin } from "@/lib/admin";
import { sendInviteEmail } from "@/lib/email";

const INVITE_DAYS = 7;

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  const invites = await prisma.invite.findMany({ orderBy: { createdAt: "desc" }, take: 50 });

  // "Used" only means an account was created. Whether that person can actually
  // get in is a separate question — the first friend invited had a used invite
  // and an account stuck waiting on a confirmation email — so answer it here.
  const userIds = invites.map(i => i.usedByUserId).filter((id): id is string => !!id);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, ...accountStatusSelect },
  });
  const byId = new Map(users.map(u => [u.id, u]));

  return NextResponse.json(
    invites.map(invite => {
      const user = invite.usedByUserId ? byId.get(invite.usedByUserId) : undefined;
      return { ...invite, account: user ? { id: user.id, ...accountStatus(user) } : null };
    })
  );
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { email } = await req.json();
  const expiresAt = new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000);

  const invite = await prisma.invite.create({
    data: { email: email || null, expiresAt, createdById: admin.id },
  });

  // Say whether the email went, rather than showing an invite as sent when the
  // person will never hear about it.
  let emailError: string | null = null;
  if (email) {
    try {
      await sendInviteEmail(email, invite.token, admin.name ?? "TrainAI");
    } catch (e) {
      Sentry.captureException(e, { tags: { stage: "invite-email" } });
      emailError = e instanceof Error ? e.message : "Erro ao enviar";
    }
  }

  return NextResponse.json({ ...invite, account: null, emailError });
}

/** Sends the invite email again, renewing the invite first if it has expired. */
export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { id } = await req.json();
  const invite = await prisma.invite.findUnique({ where: { id } });
  if (!invite) return NextResponse.json({ error: "Convite não encontrado" }, { status: 404 });
  if (invite.usedAt) return NextResponse.json({ error: "Este convite já foi usado" }, { status: 400 });
  if (!invite.email) {
    return NextResponse.json({ error: "Convite genérico: copia o link e envia-o tu" }, { status: 400 });
  }

  const renewed = invite.expiresAt < new Date()
    ? await prisma.invite.update({
        where: { id },
        data: { expiresAt: new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000) },
      })
    : invite;

  try {
    await sendInviteEmail(invite.email, invite.token, admin.name ?? "TrainAI");
  } catch (e) {
    Sentry.captureException(e, { tags: { stage: "invite-email-resend" } });
    return NextResponse.json(
      { error: `Falhou: ${e instanceof Error ? e.message : "erro desconhecido"}` },
      { status: 502 }
    );
  }

  return NextResponse.json({ ...renewed, account: null, message: `Convite reenviado para ${invite.email}.` });
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  const { id } = await req.json();
  await prisma.invite.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
