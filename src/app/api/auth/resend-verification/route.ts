export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email";

const schema = z.object({
  email: z.string().email(),
  password: z.string(),
});

/** One resend a minute per address: enough to retry, too slow to flood an inbox. */
const lastSent = new Map<string, number>();
const COOLDOWN_MS = 60 * 1000;

/**
 * Sends a fresh confirmation link to someone whose first one never arrived.
 *
 * Asks for the password as well as the email. Without it this would let anyone
 * fire confirmation emails at any address, and confirm which addresses have an
 * account; with it, only the person who just typed the right password can.
 */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    return NextResponse.json({ error: "Credenciais inválidas" }, { status: 401 });
  }
  if (user.emailVerified) {
    return NextResponse.json({ ok: true, alreadyVerified: true });
  }

  const last = lastSent.get(email) ?? 0;
  if (Date.now() - last < COOLDOWN_MS) {
    return NextResponse.json({ error: "Acabámos de enviar. Aguarda um minuto." }, { status: 429 });
  }

  // A fresh token every time: the old one may be the one that expired.
  const verificationToken = crypto.randomBytes(32).toString("hex");
  await prisma.user.update({
    where: { id: user.id },
    data: {
      verificationToken,
      verificationTokenExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  try {
    await sendVerificationEmail(email, user.name ?? "atleta", verificationToken);
  } catch (e) {
    Sentry.captureException(e, { tags: { stage: "resend-verification" } });
    return NextResponse.json(
      { error: "Não foi possível enviar o email. Tenta mais tarde." },
      { status: 502 }
    );
  }

  lastSent.set(email, Date.now());
  return NextResponse.json({ ok: true });
}
