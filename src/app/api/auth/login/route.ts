export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { createSession, SUSPENDED_MESSAGE } from "@/lib/session";
import { afterFailure, cleared, isLocked, minutesLeft } from "@/lib/login-lock";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = loginSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { email },
      include: { athlete: true },
    });

    if (!user || !user.passwordHash) {
      return NextResponse.json({ error: "Credenciais inválidas" }, { status: 401 });
    }

    // Checked before the password, so a guesser gets nothing out of a locked account.
    if (isLocked(user)) {
      const mins = minutesLeft(user);
      return NextResponse.json(
        { error: `Muitas tentativas falhadas. Tenta novamente dentro de ${mins} minuto${mins === 1 ? "" : "s"}.` },
        { status: 429 }
      );
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      await prisma.user.update({ where: { id: user.id }, data: afterFailure(user) });
      return NextResponse.json({ error: "Credenciais inválidas" }, { status: 401 });
    }

    // Only wrong passwords count. Counting every attempt meant someone waiting on
    // a confirmation email locked themselves out just by checking whether it had
    // arrived — which is what happened to the first friend invited.
    if (user.failedLoginCount > 0 || user.lockedUntil) {
      await prisma.user.update({ where: { id: user.id }, data: cleared });
    }

    // After the password, so a suspension is only ever revealed to the account's owner.
    if (user.suspendedAt) {
      return NextResponse.json({ error: SUSPENDED_MESSAGE, code: "SUSPENDED" }, { status: 403 });
    }

    // Only block unverified users if they have a verificationToken set
    // (meaning they registered after the email verification feature was added)
    if (!user.emailVerified && user.verificationToken) {
      return NextResponse.json(
        {
          error: "Email não confirmado. Verifica a tua caixa de entrada, incluindo o spam.",
          code: "EMAIL_NOT_VERIFIED",
        },
        { status: 403 }
      );
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    await createSession(user.id, req.headers.get("user-agent"));

    const hasAthlete = !!user.athlete;
    const hasCompletedOnboarding = hasAthlete && !!user.athlete?.fitnessLevel;

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      redirectTo: hasCompletedOnboarding ? "/dashboard" : "/onboarding",
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }
    console.error("Login error:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
