export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { cookies } from "next/headers";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// Simple in-memory rate limiting (resets on server restart)
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(email: string): boolean {
  const now = Date.now();
  const record = loginAttempts.get(email);
  if (!record || record.resetAt < now) {
    loginAttempts.set(email, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return true;
  }
  if (record.count >= 5) return false;
  record.count++;
  return true;
}

function clearRateLimit(email: string) {
  loginAttempts.delete(email);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = loginSchema.parse(body);

    // Rate limiting check
    if (!checkRateLimit(email)) {
      return NextResponse.json(
        { error: "Muitas tentativas. Tenta novamente em 15 minutos." },
        { status: 429 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { athlete: true },
    });

    if (!user || !user.passwordHash) {
      return NextResponse.json({ error: "Credenciais inválidas" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Credenciais inválidas" }, { status: 401 });
    }

    // Only block unverified users if they have a verificationToken set
    // (meaning they registered after the email verification feature was added)
    if (!user.emailVerified && user.verificationToken) {
      return NextResponse.json(
        { error: "Email não confirmado. Verifica a tua caixa de entrada." },
        { status: 403 }
      );
    }

    // Clear rate limit on successful login
    clearRateLimit(email);

    const cookieStore = await cookies();
    cookieStore.set("user_id", user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 dias
      path: "/",
    });

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
