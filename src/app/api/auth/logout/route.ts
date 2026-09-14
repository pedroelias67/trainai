export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { destroySession } from "@/lib/session";

export async function POST() {
  // Deletes the session row, not just the cookie: a copied cookie stops working too.
  await destroySession();
  return NextResponse.redirect(new URL("/auth/login", process.env.NEXTAUTH_URL ?? "http://localhost:3000"));
}
