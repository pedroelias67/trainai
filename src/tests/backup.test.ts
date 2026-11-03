import { describe, it, expect, vi, beforeEach } from "vitest";

// The point of these is the redaction. A backup file lands in a Downloads
// folder and gets copied to a drive and a cloud account without much thought;
// it must not be a working set of keys to other people's Strava accounts.
const db = vi.hoisted(() => {
  const vazio = async (): Promise<Record<string, unknown>[]> => [];
  return {
    user: { findMany: vi.fn() },
    account: { findMany: vi.fn(vazio) },
    session: { findMany: vi.fn(vazio) },
    athlete: { findMany: vi.fn() },
    event: { findMany: vi.fn(vazio) },
    trainingPlan: { findMany: vi.fn(vazio) },
    trainingWeek: { findMany: vi.fn(vazio) },
    trainingSession: { findMany: vi.fn(vazio) },
    activity: { findMany: vi.fn(vazio) },
    wellnessLog: { findMany: vi.fn(vazio) },
    weeklyReport: { findMany: vi.fn(vazio) },
    personalRecord: { findMany: vi.fn(vazio) },
    nutritionPlan: { findMany: vi.fn(vazio) },
    shoe: { findMany: vi.fn(vazio) },
    invite: { findMany: vi.fn(vazio) },
  };
});
vi.mock("@/lib/prisma", () => ({ prisma: db }));

const SEGREDOS = [
  "$2b$10$hashhashhash",
  "token-de-verificacao",
  "strava-access-secreto",
  "strava-refresh-secreto",
  "chave-do-intervals",
  "convite-secreto",
];

beforeEach(() => {
  vi.clearAllMocks();
  db.user.findMany.mockResolvedValue([{
    id: "u1", email: "amigo@exemplo.pt", name: "Francisco",
    passwordHash: "$2b$10$hashhashhash",
    verificationToken: "token-de-verificacao",
    resetToken: null,
    emailVerified: true,
  }]);
  db.athlete.findMany.mockResolvedValue([{
    id: "a1", userId: "u1", fitnessLevel: "ADVANCED", ltPace: "4:45",
    stravaAccessToken: "strava-access-secreto",
    stravaRefreshToken: "strava-refresh-secreto",
    stravaAthleteId: "2536028",
    intervalsIcuApiKey: "chave-do-intervals",
    pushSubscription: { endpoint: "https://push.exemplo/abc" },
  }]);
  db.invite.findMany.mockResolvedValue([{ id: "i1", email: "x@y.pt", token: "convite-secreto" }]);
});

describe("buildBackup", () => {
  it("não deixa escapar uma única credencial para o ficheiro", async () => {
    const { buildBackup } = await import("@/lib/backup");
    const texto = JSON.stringify(await buildBackup());

    for (const segredo of SEGREDOS) {
      expect(texto).not.toContain(segredo);
    }
    // E o endpoint de notificações, que também identifica um dispositivo.
    expect(texto).not.toContain("push.exemplo");
  });

  it("guarda tudo o resto, que é o que não existe em mais lado nenhum", async () => {
    const { buildBackup } = await import("@/lib/backup");
    const b = await buildBackup();

    expect(b.tables.User[0]).toMatchObject({ id: "u1", email: "amigo@exemplo.pt", name: "Francisco" });
    expect(b.tables.Athlete[0]).toMatchObject({ fitnessLevel: "ADVANCED", ltPace: "4:45" });
    // O id do Strava fica: identifica a conta ligada e não dá acesso a nada.
    expect(b.tables.Athlete[0]).toMatchObject({ stravaAthleteId: "2536028" });
  });

  it("mantém o campo apagado como nulo, em vez de o remover", async () => {
    // Um restauro espera a forma da linha, e quem lê o ficheiro deve poder
    // distinguir "foi retirado" de "nunca esteve lá".
    const { buildBackup } = await import("@/lib/backup");
    const b = await buildBackup();
    const athlete = b.tables.Athlete[0] as Record<string, unknown>;

    expect("stravaRefreshToken" in athlete).toBe(true);
    expect(athlete.stravaRefreshToken).toBeNull();
  });

  it("diz no próprio ficheiro o que um restauro não traz de volta", async () => {
    const { buildBackup } = await import("@/lib/backup");
    const b = await buildBackup();

    expect(b.notes.join(" ")).toContain("volta a ligar");
    expect(b.redacted.Athlete).toContain("intervalsIcuApiKey");
    expect(b.formatVersion).toBe(1);
  });

  it("conta as linhas que leu, não as que escreveu", async () => {
    const { buildBackup } = await import("@/lib/backup");
    const b = await buildBackup();
    expect(b.counts.User).toBe(1);
    expect(b.counts.Athlete).toBe(1);
    expect(b.counts.Activity).toBe(0);
  });

  it("inclui todas as tabelas, mesmo as vazias", async () => {
    // Uma tabela em falta no ficheiro é indistinguível de uma tabela que se
    // esqueceram de exportar, e só se descobre ao restaurar.
    const { buildBackup } = await import("@/lib/backup");
    const b = await buildBackup();
    for (const t of ["User", "Athlete", "TrainingPlan", "TrainingSession", "Activity", "WeeklyReport", "PersonalRecord", "Invite"]) {
      expect(b.tables).toHaveProperty(t);
    }
  });

  it("nomeia o ficheiro pela data, para ordenar numa pasta", async () => {
    const { backupFilename } = await import("@/lib/backup");
    expect(backupFilename(new Date("2026-11-03T19:04:00Z"))).toBe("trainai-backup-2026-11-03.json");
  });
});
