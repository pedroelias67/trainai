import { NextResponse } from "next/server";
import { deleteAccountData } from "@/lib/delete-account";
import { getSessionUserId, LEGACY_COOKIE, SESSION_COOKIE } from "@/lib/session";

export async function DELETE() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  await deleteAccountData(userId);

  // The session rows went with the account; this clears the cookie itself.
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE);
  response.cookies.delete(LEGACY_COOKIE);
  return response;
}
