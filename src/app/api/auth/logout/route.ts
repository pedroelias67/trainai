export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete("user_id");
  return NextResponse.redirect(new URL("/auth/login", process.env.NEXTAUTH_URL ?? "http://localhost:3000"));
}
