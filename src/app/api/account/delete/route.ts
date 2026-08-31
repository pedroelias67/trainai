import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { deleteAccountData } from "@/lib/delete-account";

export async function DELETE() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("user_id")?.value;
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  await deleteAccountData(userId);

  // Clear session cookie
  const response = NextResponse.json({ ok: true });
  response.cookies.delete("user_id");
  return response;
}
