export const dynamic = "force-dynamic";
// Reading every table of a small database, which took about a second when this
// was written. The ceiling is here so it fails loudly rather than at 60.
export const maxDuration = 120;

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { backupFilename, buildBackup } from "@/lib/backup";

/**
 * Hands the admin a copy of the data, as a file.
 *
 * Pressed in a browser, it downloads; nothing to install, nothing to schedule,
 * and it works from a phone on a Sunday. The nightly, complete, encrypted copy
 * is scripts/backup-db.sh, which needs the Postgres tools and therefore a real
 * machine — the two are not alternatives to each other.
 */
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const takenAt = new Date();
  const backup = await buildBackup(takenAt);

  // Indented, because a backup is also a thing you read when something has gone
  // wrong and you need to see what is in it. The file is small enough that the
  // whitespace costs nothing worth saving.
  return new NextResponse(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${backupFilename(takenAt)}"`,
      "Cache-Control": "no-store",
    },
  });
}
