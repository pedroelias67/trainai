export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { sendPasswordResetEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ ok: true }); // Don't reveal if email exists

  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpiry },
    });
    try {
      await sendPasswordResetEmail(email, user.name ?? "atleta", resetToken);
    } catch (e) { console.error(e); }
  }

  return NextResponse.json({ ok: true }); // Always return ok (security)
}
