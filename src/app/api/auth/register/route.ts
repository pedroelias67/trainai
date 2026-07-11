import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { cookies } from "next/headers";

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
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
    const { name, email, password, athlete } = registerSchema.parse(body);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email já registado" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
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

    const cookieStore = await cookies();
    cookieStore.set("user_id", user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }
    console.error("Register error:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
