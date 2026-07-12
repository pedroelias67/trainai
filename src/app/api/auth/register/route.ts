export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import crypto from "crypto";
import { sendVerificationEmail } from "@/lib/email";

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  inviteToken: z.string().optional(),
  athlete: z.object({
    dateOfBirth: z.string().optional(),
    gender: z.string().optional(),
    fitnessLevel: z.string().optional(),
    weeklyHours: z.number().optional(),
    maxHR: z.number().optional(),
    restingHR: z.number().optional(),
  }).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, password, inviteToken, athlete } = registerSchema.parse(body);

    // Check invite if required
    const inviteOnly = process.env.INVITE_ONLY === "true";
    let invite = null;
    if (inviteToken) {
      invite = await prisma.invite.findUnique({ where: { token: inviteToken } });
      if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
        return NextResponse.json({ error: "Convite inválido ou expirado" }, { status: 400 });
      }
      if (invite.email && invite.email.toLowerCase() !== email.toLowerCase()) {
        return NextResponse.json({ error: "Este convite é para outro email" }, { status: 400 });
      }
    } else if (inviteOnly) {
      return NextResponse.json({ error: "Registo apenas por convite" }, { status: 403 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return NextResponse.json({ error: "Email já registado" }, { status: 409 });

    const passwordHash = await bcrypt.hash(password, 12);
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const user = await prisma.user.create({
      data: {
        name, email, passwordHash,
        emailVerified: false,
        verificationToken,
        verificationTokenExpiry,
        athlete: {
          create: {
            ...(athlete?.dateOfBirth && { dateOfBirth: new Date(athlete.dateOfBirth) }),
            ...(athlete?.gender && { gender: athlete.gender as any }),
            ...(athlete?.fitnessLevel && { fitnessLevel: athlete.fitnessLevel as any }),
            ...(athlete?.weeklyHours && { weeklyHours: athlete.weeklyHours }),
            ...(athlete?.maxHR && { maxHR: athlete.maxHR }),
            ...(athlete?.restingHR && { restingHR: athlete.restingHR }),
          },
        },
      },
    });

    // Mark invite as used
    if (invite) {
      await prisma.invite.update({
        where: { token: inviteToken! },
        data: { usedAt: new Date(), usedByUserId: user.id },
      });
    }

    // Send verification email (don't fail registration if email fails)
    try {
      await sendVerificationEmail(email, name, verificationToken);
    } catch (e) {
      console.error("Failed to send verification email:", e);
    }

    return NextResponse.json({ requiresVerification: true, email });
  } catch (err: any) {
    if (err?.name === "ZodError") return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    console.error(err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
