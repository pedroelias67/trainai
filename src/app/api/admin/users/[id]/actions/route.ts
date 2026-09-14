export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { accountStatus, accountStatusSelect, ADMIN_EMAIL, requireAdmin } from "@/lib/admin";
import { revokeAllSessions } from "@/lib/session";
import { cleared } from "@/lib/login-lock";
import { sendPasswordResetEmail, sendVerificationEmail, sendWelcomeEmail } from "@/lib/email";

const ACTIONS = [
  "activate", "unlock", "resend-verification", "send-password-reset", "send-welcome",
  "suspend", "unsuspend", "revoke-sessions",
] as const;
type Action = (typeof ACTIONS)[number];

const sessionsEnded = (n: number) =>
  n === 1 ? "1 sessão terminada" : `${n} sessões terminadas`;

/**
 * The fixes an admin reaches for when someone cannot get in: confirm the account
 * by hand, lift a lockout, or send the email that did not arrive.
 *
 * Every action answers with the account's status afterwards, so the admin page
 * shows what is now true rather than what it assumes happened.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const action = body?.action as Action;
  if (!ACTIONS.includes(action)) {
    return NextResponse.json({ error: "Ação desconhecida" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true },
  });
  if (!user) return NextResponse.json({ error: "Utilizador não encontrado" }, { status: 404 });

  // Suspending the admin would lock the only person able to undo it.
  if (action === "suspend" && user.email === ADMIN_EMAIL) {
    return NextResponse.json({ error: "Não podes suspender a conta de administrador" }, { status: 400 });
  }

  let message: string;

  try {
    switch (action) {
      case "activate": {
        await prisma.user.update({
          where: { id },
          data: { emailVerified: true, verificationToken: null, verificationTokenExpiry: null },
        });
        // Whoever needed this was stuck and has probably given up checking. Tell
        // them it is fixed, or they will not try again. The account is active
        // either way, so a failed email is reported rather than undoing it.
        try {
          await sendWelcomeEmail(user.email, user.name ?? "atleta");
          message = `Conta ativada. Email de boas-vindas enviado para ${user.email}.`;
        } catch (e) {
          Sentry.captureException(e, { tags: { stage: "admin-activate-welcome" } });
          message = "Conta ativada, mas o email de aviso não seguiu — avisa a pessoa diretamente.";
        }
        break;
      }

      case "unlock":
        await prisma.user.update({ where: { id }, data: cleared });
        message = "Conta desbloqueada.";
        break;

      case "resend-verification": {
        const verificationToken = crypto.randomBytes(32).toString("hex");
        await prisma.user.update({
          where: { id },
          data: {
            verificationToken,
            verificationTokenExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });
        await sendVerificationEmail(user.email, user.name ?? "atleta", verificationToken);
        message = `Email de confirmação enviado para ${user.email}.`;
        break;
      }

      case "suspend": {
        // The flag stops new sign-ins and every request's session check; deleting
        // the sessions as well means nothing already open outlives the decision.
        await prisma.user.update({ where: { id }, data: { suspendedAt: new Date() } });
        const ended = await revokeAllSessions(id);
        message = `Acesso suspenso.${ended ? ` ${sessionsEnded(ended)}.` : ""}`;
        break;
      }

      case "unsuspend":
        await prisma.user.update({ where: { id }, data: { suspendedAt: null } });
        message = "Acesso reativado. Pode voltar a entrar.";
        break;

      case "revoke-sessions": {
        const ended = await revokeAllSessions(id);
        message = ended
          ? `${sessionsEnded(ended)}. Terá de voltar a entrar.`
          : "Não havia sessões abertas.";
        break;
      }

      case "send-welcome": {
        // For an account activated some other way — by hand, or before the
        // activation email existed — whose owner was never told they can sign in.
        const account = await prisma.user.findUniqueOrThrow({
          where: { id },
          select: { emailVerified: true, verificationToken: true },
        });
        if (!account.emailVerified && account.verificationToken) {
          return NextResponse.json(
            { error: "A conta ainda não está ativa. Ativa-a primeiro." },
            { status: 400 }
          );
        }
        await sendWelcomeEmail(user.email, user.name ?? "atleta");
        message = `Email de boas-vindas enviado para ${user.email}.`;
        break;
      }

      case "send-password-reset": {
        const resetToken = crypto.randomBytes(32).toString("hex");
        await prisma.user.update({
          where: { id },
          data: { resetToken, resetTokenExpiry: new Date(Date.now() + 60 * 60 * 1000) },
        });
        await sendPasswordResetEmail(user.email, user.name ?? "atleta", resetToken);
        message = `Link para nova password enviado para ${user.email}. Válido 1 hora.`;
        break;
      }
    }
  } catch (e) {
    Sentry.captureException(e, { tags: { stage: `admin-${action}` } });
    return NextResponse.json(
      { error: `Falhou: ${e instanceof Error ? e.message : "erro desconhecido"}` },
      { status: 502 }
    );
  }

  const after = await prisma.user.findUniqueOrThrow({ where: { id }, select: accountStatusSelect() });
  return NextResponse.json({ ok: true, message, status: accountStatus(after) });
}
