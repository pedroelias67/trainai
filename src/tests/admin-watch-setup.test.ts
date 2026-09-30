import { describe, it, expect, vi, beforeEach } from "vitest";
import type { WatchNotice } from "@/lib/connection-status";

// The refusal is the part worth pinning. An email asking someone to fix what
// is not broken is worse than no email: it spends the attention the next one
// will need.
const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
  athlete: { findUnique: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

const admin = vi.hoisted(() => ({ requireAdmin: vi.fn(async () => true) }));
vi.mock("@/lib/admin", () => ({
  requireAdmin: admin.requireAdmin,
  ADMIN_EMAIL: "pedroelias67@gmail.com",
  accountStatusSelect: () => ({ id: true }),
  accountStatus: () => ({ ok: true }),
}));

const email = vi.hoisted(() => ({ sendWatchSetupEmail: vi.fn() }));
vi.mock("@/lib/email", () => ({
  sendWatchSetupEmail: email.sendWatchSetupEmail,
  sendWelcomeEmail: vi.fn(),
  sendVerificationEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}));

const watch = vi.hoisted(() => ({ loadWatchNotice: vi.fn() }));
vi.mock("@/lib/athlete-watch", () => ({ loadWatchNotice: watch.loadWatchNotice }));

vi.mock("@/lib/session", () => ({ revokeAllSessions: vi.fn(async () => 0) }));
vi.mock("@/lib/login-lock", () => ({ cleared: {} }));
vi.mock("@/lib/weekly-report", () => ({
  emailWeekReport: vi.fn(), generateWeekReport: vi.fn(), lastFinishedWeek: vi.fn(),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

const aviso: WatchNotice = {
  reason: "not-connected",
  level: "warning",
  title: "Os treinos não estão a chegar ao teu relógio",
  detail: "Falta ligar o Intervals.icu.",
  action: { label: "Ligar o relógio", href: "/dashboard/profile" },
};

function pedido() {
  return new Request("https://trainai.test/api/admin/users/u1/actions", {
    method: "POST",
    body: JSON.stringify({ action: "send-watch-setup" }),
  });
}
const params = Promise.resolve({ id: "u1" });

beforeEach(() => {
  vi.clearAllMocks();
  admin.requireAdmin.mockResolvedValue(true);
  db.user.findUnique.mockResolvedValue({ id: "u1", email: "amigo@exemplo.pt", name: "Francisco" });
  db.user.findUniqueOrThrow.mockResolvedValue({ id: "u1" });
  db.athlete.findUnique.mockResolvedValue({ id: "a1" });
});

describe("ação send-watch-setup", () => {
  it("envia quando há mesmo alguma coisa a pedir", async () => {
    watch.loadWatchNotice.mockResolvedValue(aviso);
    const { POST } = await import("@/app/api/admin/users/[id]/actions/route");

    const res = await POST(pedido() as never, { params });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(email.sendWatchSetupEmail).toHaveBeenCalledWith("amigo@exemplo.pt", "Francisco", aviso);
    // A mensagem diz ao admin o que foi pedido, não só que "foi enviado".
    expect(body.message).toContain("não estão a chegar ao teu relógio");
  });

  it("recusa quando o relógio do atleta já está a receber os treinos", async () => {
    watch.loadWatchNotice.mockResolvedValue(null);
    const { POST } = await import("@/app/api/admin/users/[id]/actions/route");

    const res = await POST(pedido() as never, { params });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("está a receber os treinos");
    expect(email.sendWatchSetupEmail).not.toHaveBeenCalled();
  });

  it("recusa para uma conta sem perfil de atleta", async () => {
    db.athlete.findUnique.mockResolvedValue(null);
    const { POST } = await import("@/app/api/admin/users/[id]/actions/route");

    const res = await POST(pedido() as never, { params });
    expect(res.status).toBe(400);
    expect(watch.loadWatchNotice).not.toHaveBeenCalled();
    expect(email.sendWatchSetupEmail).not.toHaveBeenCalled();
  });

  it("não envia nada a pedido de quem não é administrador", async () => {
    admin.requireAdmin.mockResolvedValue(false);
    const { POST } = await import("@/app/api/admin/users/[id]/actions/route");

    const res = await POST(pedido() as never, { params });
    expect(res.status).toBe(403);
    expect(email.sendWatchSetupEmail).not.toHaveBeenCalled();
  });
});
