export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { loadProgress } from "@/lib/admin-progress";

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  return NextResponse.json(await loadProgress());
}
