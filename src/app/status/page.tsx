export const dynamic = "force-dynamic";

import Link from "next/link";
import { LogoFull } from "@/components/ui/Logo";
import { prisma } from "@/lib/prisma";

const BASE_URL = process.env.NEXTAUTH_URL ?? "https://trainai.pedroelias.com";

const SERVICES = [
  { key: "database",  label: "Base de Dados",        desc: "PostgreSQL via Supabase" },
  { key: "ai",        label: "Inteligência Artificial", desc: "Claude (Anthropic)" },
  { key: "email",     label: "Email Transacional",    desc: "Resend" },
  { key: "push",      label: "Notificações Push",     desc: "Web Push / VAPID" },
] as const;

async function getHealth() {
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbLatency = Date.now() - start;
    return {
      database: { ok: true, latencyMs: dbLatency },
      ai:    { ok: !!process.env.ANTHROPIC_API_KEY },
      email: { ok: !!process.env.RESEND_API_KEY },
      push:  { ok: !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY },
    };
  } catch {
    return {
      database: { ok: false, latencyMs: null },
      ai:    { ok: !!process.env.ANTHROPIC_API_KEY },
      email: { ok: !!process.env.RESEND_API_KEY },
      push:  { ok: !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY },
    };
  }
}

export default async function StatusPage() {
  const health = await getHealth();
  const allOk = Object.values(health).every(s => s.ok);

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <header className="border-b border-[var(--border)] px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <LogoFull size={28} />
          <Link href="/dashboard" className="text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
            ← Voltar
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12">
        {/* Overall status */}
        <div className={`flex items-center gap-4 p-6 rounded-2xl border mb-8 ${
          allOk
            ? "border-green-500/30 bg-green-500/5"
            : "border-yellow-500/30 bg-yellow-500/5"
        }`}>
          <div className={`w-4 h-4 rounded-full shrink-0 ${allOk ? "bg-green-500 animate-pulse" : "bg-yellow-500"}`} />
          <div>
            <p className={`font-bold text-lg ${allOk ? "text-green-400" : "text-yellow-400"}`}>
              {allOk ? "Todos os sistemas operacionais" : "Degradação parcial do serviço"}
            </p>
            <p className="text-[var(--text-muted)] text-sm mt-0.5">
              Atualizado em tempo real · {new Date().toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" })}
            </p>
          </div>
        </div>

        {/* Services */}
        <div className="space-y-3 mb-10">
          {SERVICES.map(({ key, label, desc }) => {
            const service = health[key];
            const ok = service.ok;
            const latency = "latencyMs" in service ? service.latencyMs : null;

            return (
              <div key={key} className="flex items-center justify-between p-5 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)]">
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${ok ? "bg-green-500" : "bg-red-500"}`} />
                  <div>
                    <p className="font-medium text-[var(--text-primary)] text-sm">{label}</p>
                    <p className="text-[var(--text-faint)] text-xs">{desc}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    ok
                      ? "text-green-400 bg-green-500/10 border border-green-500/20"
                      : "text-red-400 bg-red-500/10 border border-red-500/20"
                  }`}>
                    {ok ? "Operacional" : "Indisponível"}
                  </span>
                  {latency !== null && (
                    <p className="text-[var(--text-faint)] text-xs mt-1">{latency}ms</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Info box */}
        <div className="p-5 rounded-2xl border border-[var(--border)] bg-[var(--bg-subtle)] space-y-3">
          <h2 className="font-semibold text-[var(--text-primary)] text-sm">Informações do serviço</h2>
          <div className="grid grid-cols-2 gap-3 text-xs text-[var(--text-muted)]">
            <div>
              <p className="text-[var(--text-secondary)] font-medium mb-0.5">Alojamento</p>
              <p>Vercel (Edge Network)</p>
            </div>
            <div>
              <p className="text-[var(--text-secondary)] font-medium mb-0.5">Base de dados</p>
              <p>Supabase (PostgreSQL)</p>
            </div>
            <div>
              <p className="text-[var(--text-secondary)] font-medium mb-0.5">Região principal</p>
              <p>Frankfurt, EU</p>
            </div>
            <div>
              <p className="text-[var(--text-secondary)] font-medium mb-0.5">SLA alvo</p>
              <p>99.9% de disponibilidade</p>
            </div>
          </div>
        </div>

        <p className="text-center text-[var(--text-faint)] text-xs mt-8">
          Problemas?{" "}
          <a href="mailto:pedro@pedroelias.com" className="hover:text-[var(--text-muted)] underline underline-offset-2">
            Contacta o suporte
          </a>
        </p>
      </main>
    </div>
  );
}
