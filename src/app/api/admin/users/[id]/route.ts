export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ADMIN_EMAIL, requireAdmin } from "@/lib/admin";
import { deleteAccountData } from "@/lib/delete-account";
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
    select: { id: true, name: true, email: true },
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
