import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { LogoFull } from "@/components/ui/Logo";
import { getSessionUserId } from "@/lib/session";

/**
 * Every plan the athlete has trained to, not just the one in force.
 *
 * Editing training preferences archives the current plan and generates another.
 * The archived one kept its weeks, its sessions and the coach's analyses, but
 * every page in the app asked for the active plan — so the moment a plan was
 * replaced, the training recorded against it became invisible.
 */
export default async function PlansHistoryPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/auth/login");

  const athlete = await prisma.athlete.findUnique({ where: { userId }, select: { id: true } });
  if (!athlete) redirect("/onboarding");

  const plans = await prisma.trainingPlan.findMany({
    where: { athleteId: athlete.id },
    orderBy: [{ status: "asc" }, { startDate: "desc" }],
    select: {
      id: true, name: true, status: true, startDate: true, endDate: true, totalWeeks: true,
      event: { select: { name: true, date: true, distance: true } },
      weeks: { select: { sessions: { select: { completed: true, activity: { select: { distance: true } } } } } },
    },
  });

  const fmt = (d: Date) => d.toLocaleDateString("pt-PT", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <header className="sticky top-0 z-40 border-b border-[var(--border)] backdrop-blur-xl bg-[var(--bg-base)]/80 px-6 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <LogoFull size={30} href="/dashboard" />
          <Link href="/dashboard/plan" className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm transition-colors">
            ← Plano
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Histórico de planos</h1>
        <p className="text-[var(--text-muted)] text-sm mt-1 mb-8">
          Todos os planos que seguiste, incluindo os que foram substituídos.
        </p>

        {plans.length === 0 ? (
          <div className="card text-center py-12 text-[var(--text-muted)] text-sm">Ainda não tens planos.</div>
        ) : (
          <div className="space-y-3">
            {plans.map(plan => {
              const sessions = plan.weeks.flatMap(w => w.sessions);
              const done = sessions.filter(s => s.completed).length;
              const km = sessions.reduce((sum, s) => sum + (s.activity?.distance ?? 0), 0) / 1000;
              const active = plan.status === "ACTIVE";

              return (
                <Link key={plan.id} href={`/dashboard/plans/${plan.id}`}
                  className={`card block hover:border-[var(--border-hover)] transition-colors ${active ? "border-green-500/30" : ""}`}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[var(--text-primary)] font-medium text-sm">{plan.event.name}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${
                          active
                            ? "bg-green-500/10 text-green-400 border-green-500/20"
                            : "bg-[var(--bg-hover)] text-[var(--text-muted)] border-[var(--border-hover)]"
                        }`}>
                          {active ? "ativo" : "arquivado"}
                        </span>
                      </div>
                      <p className="text-[var(--text-muted)] text-xs mt-1">{plan.name}</p>
                      <p className="text-[var(--text-faint)] text-xs mt-1">
                        {fmt(plan.startDate)} → {fmt(plan.endDate)} · {plan.totalWeeks} semanas
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[var(--text-primary)] text-sm font-semibold">
                        {done}/{sessions.length} treinos
                      </p>
                      {km > 0 && <p className="text-[var(--text-muted)] text-xs">{km.toFixed(0)} km feitos</p>}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
