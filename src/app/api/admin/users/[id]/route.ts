export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { deleteAccountData } from "@/lib/delete-account";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "pedroelias67@gmail.com";
async function requireAdmin() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("user_id")?.value;
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.email !== ADMIN_EMAIL) return null;
  return user;
}
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json();
  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(body.name && { name: body.name }),
      ...(body.email && { email: body.email }),
    },
  });
  return NextResponse.json(user);
}
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }
  const { id } = await params;

  // Deleting the user and trusting the cascade fails on any account holding a
  // plan: TrainingPlan → Event and WeeklyReport → TrainingWeek are required
  // relations, so Prisma leaves them as Restrict.
  const alvo = await prisma.user.findUnique({ where: { id }, select: { email: true } });
  if (!alvo) return NextResponse.json({ error: "Utilizador não encontrado" }, { status: 404 });

  if (alvo.email === ADMIN_EMAIL) {
    return NextResponse.json({ error: "Não podes eliminar a conta de administrador" }, { status: 400 });
  }

  await deleteAccountData(id);
  return NextResponse.json({ ok: true });
}
