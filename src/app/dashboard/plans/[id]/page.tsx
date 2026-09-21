import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { LogoFull } from "@/components/ui/Logo";
import { getSessionUserId } from "@/lib/session";
import { parseWeekAnalysis } from "@/lib/week-analysis";
import { formatClock } from "@/lib/format";
import { SESSION_TYPES } from "@/lib/session-types";

/** A plan as it was trained: what was planned, what was done, what the coach said. */
export default async function PlanHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const userId = await getSessionUserId();
  if (!userId) redirect("/auth/login");
  const athlete = await prisma.athlete.findUnique({ where: { userId }, select: { id: true } });
  if (!athlete) redirect("/onboarding");

  const plan = await prisma.trainingPlan.findFirst({
    where: { id, athleteId: athlete.id },
    select: {
      id: true, name: true, status: true, startDate: true, endDate: true, totalWeeks: true,
      event: { select: { name: true, date: true } },
      weeks: {
        orderBy: { weekNumber: "asc" },
        select: {
          id: true, weekNumber: true, startDate: true, focus: true, aiAnalysis: true, adaptations: true,
          weeklyReport: { select: { aiSummary: true, completedSessions: true, plannedSessions: true, actualDistance: true } },
          sessions: {
            orderBy: { date: "asc" },
            select: {
              id: true, name: true, sessionType: true, date: true, completed: true, cancelled: true,
              plannedDistance: true,
              activity: { select: { id: true, distance: true, duration: true, avgPace: true } },
            },
          },
        },
      },
    },
  });
  if (!plan) notFound();

  const all = plan.weeks.flatMap(w => w.sessions);
  const done = all.filter(s => s.completed);
  const km = done.reduce((sum, s) => sum + (s.activity?.distance ?? 0), 0) / 1000;
  const day = (d: Date) => d.toLocaleDateString("pt-PT", { day: "numeric", month: "short" });

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <header className="sticky top-0 z-40 border-b border-[var(--border)] backdrop-blur-xl bg-[var(--bg-base)]/80 px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <LogoFull size={30} href="/dashboard" />
          <Link href="/dashboard/plans" className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm transition-colors">
            ← Histórico
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{plan.event.name}</h1>
          <span className={`text-xs px-2 py-0.5 rounded-full border ${
            plan.status === "ACTIVE"
              ? "bg-green-500/10 text-green-400 border-green-500/20"
              : "bg-[var(--bg-hover)] text-[var(--text-muted)] border-[var(--border-hover)]"
          }`}>
            {plan.status === "ACTIVE" ? "ativo" : "arquivado"}
          </span>
        </div>
        <p className="text-[var(--text-muted)] text-sm">{plan.name}</p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6 mb-8">
          <div className="stat-card">
            <p className="text-[var(--text-muted)] text-xs">Treinos feitos</p>
            <p className="text-[var(--text-primary)] text-lg font-bold">{done.length} de {all.length}</p>
          </div>
          <div className="stat-card">
            <p className="text-[var(--text-muted)] text-xs">Distância</p>
            <p className="text-[var(--text-primary)] text-lg font-bold">{km.toFixed(0)} km</p>
          </div>
          <div className="stat-card">
            <p className="text-[var(--text-muted)] text-xs">Semanas</p>
            <p className="text-[var(--text-primary)] text-lg font-bold">{plan.weeks.length} de {plan.totalWeeks}</p>
          </div>
        </div>

        <div className="space-y-6">
          {plan.weeks.map(week => {
            const analysis = parseWeekAnalysis(week.aiAnalysis);
            const summary = week.weeklyReport?.aiSummary ?? analysis?.summary ?? null;
            return (
              <div key={week.id} className="card">
                <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
                  <h2 className="text-[var(--text-primary)] font-semibold text-sm">
                    Semana {week.weekNumber}
                    <span className="text-[var(--text-faint)] font-normal"> · {day(week.startDate)}</span>
                  </h2>
                  <p className="text-[var(--text-muted)] text-xs">
                    {week.sessions.filter(s => s.completed).length}/{week.sessions.length} treinos
                  </p>
                </div>
                {week.focus && <p className="text-[var(--text-secondary)] text-xs mb-3">{week.focus}</p>}

                <div className="space-y-1.5">
                  {week.sessions.map(s => (
                    <div key={s.id} className="flex items-center gap-3 text-xs">
                      <span className="w-12 text-[var(--text-faint)] shrink-0">{day(s.date)}</span>
                      <span className={`w-4 shrink-0 ${s.completed ? "text-green-400" : "text-[var(--text-faint)]"}`}>
                        {s.completed ? "✓" : s.cancelled ? "✕" : "·"}
                      </span>
                      <span className={`flex-1 min-w-0 truncate ${s.completed ? "text-[var(--text-secondary)]" : "text-[var(--text-muted)]"}`}>
                        {s.name}
                        <span className="text-[var(--text-faint)]"> · {SESSION_TYPES[s.sessionType]?.label ?? s.sessionType}</span>
                      </span>
                      <span className="text-[var(--text-muted)] shrink-0 text-right">
                        {s.activity
                          ? `${(s.activity.distance! / 1000).toFixed(1)} km · ${formatClock(s.activity.duration!)}`
                          : s.plannedDistance
                          ? `${s.plannedDistance} km prev.`
                          : ""}
                      </span>
                      {s.activity && (
                        <Link href={`/dashboard/activity/${s.activity.id}`}
                          className="text-[var(--text-faint)] hover:text-[var(--text-secondary)] shrink-0">
                          ver →
                        </Link>
                      )}
                    </div>
                  ))}
                </div>

                {summary && (
                  <div className="mt-4 pt-3 border-t border-[var(--border)]">
                    <p className="text-[var(--text-faint)] text-[11px] uppercase tracking-wide mb-1">Análise do treinador</p>
                    <p className="text-[var(--text-secondary)] text-xs leading-relaxed whitespace-pre-line">{summary}</p>
                  </div>
                )}
                {week.adaptations && (
                  <div className="mt-3">
                    <p className="text-[var(--text-faint)] text-[11px] uppercase tracking-wide mb-1">Ajustes aplicados</p>
                    <p className="text-[var(--text-secondary)] text-xs leading-relaxed whitespace-pre-line">{week.adaptations}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
