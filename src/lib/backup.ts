// Taking the data out, so it exists somewhere that is not Supabase.
//
// The code is on GitHub and the activities could be fetched from Strava again.
// What exists nowhere else is everything the app made: the plans, the weeks,
// the sessions, the weekly analyses, the records, the accounts. That is the
// part worth carrying out of the building.
//
// This runs anywhere — it is Prisma reads and JSON, not pg_dump, which does not
// exist in a serverless runtime. It is therefore not a whole-database backup:
// no schema, no Supabase auth tables, no extensions. scripts/backup-db.sh does
// that one, from a machine that has the Postgres tools. This is the copy an
// admin can take from a browser on any day, without tooling.
//
// Secrets are left out on purpose, listed below. A file that lands in a
// Downloads folder should not be a set of working keys to other people's
// Strava and Intervals.icu accounts. What that costs is stated in the file
// itself: after a restore, every athlete reconnects.

import { prisma } from "@/lib/prisma";

/** Fields never written to an export, per table. */
export const REDACTED: Record<string, string[]> = {
  User: ["passwordHash", "verificationToken", "resetToken"],
  Account: ["refresh_token", "access_token", "id_token"],
  Session: ["sessionToken"],
  Athlete: ["stravaAccessToken", "stravaRefreshToken", "intervalsIcuApiKey", "pushSubscription"],
  Invite: ["token"],
};

/** What a restore will not bring back, said plainly inside the file. */
export const RESTORE_NOTES = [
  "Sem credenciais: as ligações ao Strava e ao Intervals.icu não estão aqui.",
  "Ao restaurar, cada atleta volta a ligar o relógio e o Strava, e as palavras-passe",
  "têm de ser redefinidas. Isto é deliberado — um ficheiro de cópia não deve ser um",
  "molho de chaves das contas de outras pessoas.",
  "Para uma cópia completa, incluindo credenciais e esquema, usa scripts/backup-db.sh,",
  "que cifra o resultado.",
];

export type Backup = {
  formatVersion: 1;
  takenAt: string;
  counts: Record<string, number>;
  redacted: Record<string, string[]>;
  notes: string[];
  tables: Record<string, unknown[]>;
};

function limpar(linhas: Record<string, unknown>[], campos: string[]): Record<string, unknown>[] {
  if (campos.length === 0) return linhas;
  return linhas.map(linha => {
    const copia = { ...linha };
    for (const campo of campos) {
      // Kept as a key with null rather than dropped, so a restore sees the
      // shape it expects and a reader can tell "absent" from "was never set".
      if (campo in copia) copia[campo] = null;
    }
    return copia;
  });
}

/**
 * Every application table, in dependency order.
 *
 * The order is the order a restore has to insert them: a plan cannot be written
 * before the athlete it belongs to.
 */
const TABELAS: Array<[string, () => Promise<Record<string, unknown>[]>]> = [
  ["User", () => prisma.user.findMany() as never],
  ["Account", () => prisma.account.findMany() as never],
  ["Session", () => prisma.session.findMany() as never],
  ["Athlete", () => prisma.athlete.findMany() as never],
  ["Event", () => prisma.event.findMany() as never],
  ["TrainingPlan", () => prisma.trainingPlan.findMany() as never],
  ["TrainingWeek", () => prisma.trainingWeek.findMany() as never],
  ["TrainingSession", () => prisma.trainingSession.findMany() as never],
  ["Activity", () => prisma.activity.findMany() as never],
  ["WellnessLog", () => prisma.wellnessLog.findMany() as never],
  ["WeeklyReport", () => prisma.weeklyReport.findMany() as never],
  ["PersonalRecord", () => prisma.personalRecord.findMany() as never],
  ["NutritionPlan", () => prisma.nutritionPlan.findMany() as never],
  ["Shoe", () => prisma.shoe.findMany() as never],
  ["Invite", () => prisma.invite.findMany() as never],
];

export async function buildBackup(takenAt = new Date()): Promise<Backup> {
  const tables: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};

  for (const [nome, ler] of TABELAS) {
    const linhas = await ler();
    tables[nome] = limpar(linhas, REDACTED[nome] ?? []);
    counts[nome] = linhas.length;
  }

  return {
    formatVersion: 1,
    takenAt: takenAt.toISOString(),
    counts,
    redacted: REDACTED,
    notes: RESTORE_NOTES,
    tables,
  };
}

/** `trainai-backup-2026-11-03.json`, which sorts by date in a folder. */
export function backupFilename(takenAt = new Date()): string {
  return `trainai-backup-${takenAt.toISOString().slice(0, 10)}.json`;
}
