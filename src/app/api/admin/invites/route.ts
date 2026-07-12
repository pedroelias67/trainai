export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { sendInviteEmail } from "@/lib/email";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "pedroelias67@gmail.com";

async function requireAdmin() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("user_id")?.value;
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.email !== ADMIN_EMAIL) return null;
  return user;
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  const invites = await prisma.invite.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  return NextResponse.json(invites);
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { email } = await req.json();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const invite = await prisma.invite.create({
    data: { email: email || null, expiresAt, createdById: admin.id },
  });

  if (email) {
    try { await sendInviteEmail(email, invite.token, admin.name ?? "TrainAI"); } catch (e) { console.error(e); }
  }

  return NextResponse.json(invite);
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  const { id } = await req.json();
  await prisma.invite.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
