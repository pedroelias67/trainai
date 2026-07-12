export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { sendWelcomeEmail } from "@/lib/email";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.redirect(new URL("/auth/login?error=invalid_token", req.url));

  const user = await prisma.user.findUnique({ where: { verificationToken: token } });
  if (!user || !user.verificationTokenExpiry || user.verificationTokenExpiry < new Date()) {
    return NextResponse.redirect(new URL("/auth/login?error=token_expired", req.url));
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: true, verificationToken: null, verificationTokenExpiry: null },
  });

  // Auto login after verification
  const cookieStore = await cookies();
  cookieStore.set("user_id", user.id, {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", maxAge: 60 * 60 * 24 * 7, path: "/",
  });

  // Send welcome email
  try { await sendWelcomeEmail(user.email, user.name ?? "atleta"); } catch {}

  return NextResponse.redirect(new URL("/onboarding?welcome=1", req.url));
}
