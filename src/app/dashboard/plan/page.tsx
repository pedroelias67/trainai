import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { LogoFull } from "@/components/ui/Logo";
import { WeeklyAnalysis } from "@/components/dashboard/WeeklyAnalysis";
import { PlanWeekGrid } from "@/components/dashboard/PlanWeekGrid";
import { PlanWeekCollapsible } from "@/components/dashboard/PlanWeekCollapsible";
import { PlanWeekScroller } from "@/components/dashboard/PlanWeekScroller";


export default async function PlanPage() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("user_id")?.value;
  if (!userId) redirect("/auth/login");

  const athlete = await prisma.athlete.findUnique({
    where: { userId },
    include: {
      trainingPlans: {
        where: { status: "ACTIVE" },
        include: {
          event: true,
          weeks: {
            orderBy: { weekNumber: "asc" },
            include: { sessions: { orderBy: { date: "asc" } } },
          },
        },
        take: 1,
      },
    },
  });

  if (!athlete) redirect("/onboarding");

  const plan = athlete.trainingPlans[0];

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <header className="sticky top-0 z-40 border-b border-[var(--border)] backdrop-blur-xl bg-[var(--bg-base)]/80 px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <LogoFull size={30} />
          <nav className="hidden md:flex items-center gap-1">
            {[
              { href: "/dashboard", label: "Dashboard" },
              { href: "/dashboard/plan", label: "Plano" },
              { href: "/dashboard/nutrition", label: "Nutrição" },
              { href: "/dashboard/calendar", label: "Calendário" },
              { href: "/dashboard/fitness", label: "Fitness" },
              { href: "/dashboard/activities", label: "Atividades" },
              { href: "/dashboard/chat", label: "Chat IA" },
              { href: "/dashboard/profile", label: "Perfil" },
            ].map((item) => (
              <Link key={item.href} href={item.href}
                className="px-4 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all">
                {item.label}
              </Link>
            ))}
          </nav>
          <Link href="/dashboard" className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm transition-colors">← Dashboard</Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {!plan ? (
          <div className="card text-center py-20">
            <p className="text-4xl mb-4">📋</p>
            <h2 className="text-xl font-bold text-white mb-2">Sem plano ativo</h2>
            <p className="text-[var(--text-muted)] text-sm mb-6">Cria um evento para gerar o teu plano personalizado</p>
            <Link href="/onboarding" className="btn-primary inline-block">Criar plano</Link>
          </div>
        ) : (
          <div>
            {/* Plan header */}
            <div className="flex items-start justify-between mb-8 gap-4">
              <div>
                <p className="text-green-400 text-xs font-medium uppercase tracking-widest mb-1">Plano ativo</p>
                <h1 className="text-2xl font-bold text-white">{plan.event.name}</h1>
                <p className="text-[var(--text-muted)] text-sm mt-1 capitalize">
                  {format(new Date(plan.event.date), "d 'de' MMMM yyyy", { locale: pt })}
                  {" · "}{plan.totalWeeks} semanas
                </p>
                {plan.coachNotes && (
                  <p className="mt-3 text-[var(--text-secondary)] text-sm leading-relaxed max-w-2xl">{plan.coachNotes}</p>
                )}
              </div>
              <Link href="/dashboard/plan/edit" className="shrink-0 btn-secondary text-sm py-2">
                Editar preferências
              </Link>
            </div>

            {/* Auto-scroll to current week */}
            {plan.weeks.find(w => w.weekNumber === plan.currentWeek) && (
              <PlanWeekScroller currentWeekId={plan.weeks.find(w => w.weekNumber === plan.currentWeek)!.id} />
            )}

            {/* Weeks */}
            <div className="space-y-3">
              {plan.weeks.map((week) => {
                const isCurrentWeek = week.weekNumber === plan.currentWeek;
                const isPastWeek = week.weekNumber < plan.currentWeek;
                const isFutureWeek = week.weekNumber > plan.currentWeek;
                const completedCount = week.sessions.filter((s) => s.completed).length;
                // Past weeks collapsed by default; current and future open
                const defaultOpen = !isPastWeek;

                const weekHeader = (
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {isCurrentWeek && (
                      <span className="shrink-0 text-xs font-medium text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">
                        Semana atual
                      </span>
                    )}
                    <h2 className={`font-semibold text-sm truncate ${isPastWeek ? "text-[var(--text-muted)]" : "text-white"}`}>
                      Semana {week.weekNumber}
                      {week.focus && <span className="text-[var(--text-muted)] font-normal"> · {week.focus}</span>}
                    </h2>
                    <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] ml-auto shrink-0">
                      <span>{completedCount}/{week.sessions.length} treinos</span>
                      {week.totalDistance && <span>{week.totalDistance} km</span>}
                      {isPastWeek && completedCount === week.sessions.filter(s => !s.cancelled).length && (
                        <span className="text-green-400">✓</span>
                      )}
                      {isFutureWeek && <span className="text-[var(--text-faint)]">Em breve</span>}
                    </div>
                  </div>
                );

                return (
                  <div key={week.id}
                    className={`rounded-2xl border overflow-hidden transition-all ${
                      isCurrentWeek
                        ? "border-green-500/30 bg-green-500/3"
                        : isPastWeek
                        ? "border-[var(--border)] bg-[var(--bg-card)]/50 opacity-70 hover:opacity-100 transition-opacity"
                        : "border-[var(--border)] bg-[var(--bg-card)]"
                    }`}>
                    <PlanWeekCollapsible
                      weekId={week.id}
                      defaultOpen={defaultOpen}
                      header={weekHeader}
                      zipHref={`/api/weeks/${week.id}/export-tcx-zip`}
                    >
                      {/* Sessions */}
                      <PlanWeekGrid sessions={week.sessions.map((s) => ({
                        id: s.id,
                        name: s.name,
                        sessionType: s.sessionType,
                        sport: s.sport,
                        date: s.date.toISOString(),
                        dayOfWeek: s.dayOfWeek,
                        plannedDistance: s.plannedDistance ?? null,
                        plannedDuration: s.plannedDuration ?? null,
                        completed: s.completed,
                        isPriority: s.isPriority,
                        cancelled: s.cancelled,
                        shortDescription: s.shortDescription ?? null,
                        coachTip: s.coachTip ?? null,
                      }))} />

                      {/* Week coach message */}
                      {week.coachMessage && (
                        <div className="mx-3 mb-3 p-3 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-hover)]">
                          <p className="text-xs text-[var(--text-muted)] uppercase tracking-widest mb-1">Nota do treinador</p>
                          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{week.coachMessage}</p>
                        </div>
                      )}

                      {/* AI adaptations applied */}
                      {week.adaptationsApplied && week.adaptations && (
                        <div className="mx-3 mb-3 p-3 rounded-xl bg-blue-500/8 border border-blue-500/20">
                          <p className="text-xs text-blue-400 uppercase tracking-widest mb-1.5">✦ Plano adaptado pela IA</p>
                          <p className="text-xs text-[var(--text-secondary)] whitespace-pre-line leading-relaxed">{week.adaptations}</p>
                        </div>
                      )}

                      {/* Weekly AI analysis */}
                      {(isPastWeek || isCurrentWeek) && (
                        <div className="mx-3 mb-3 p-4 rounded-xl bg-[#0f0f0f] border border-[var(--border)]">
                          <WeeklyAnalysis
                            weekId={week.id}
                            weekNumber={week.weekNumber}
                            savedAnalysis={week.aiAnalysis ? JSON.parse(week.aiAnalysis as string) : null}
                          />
                        </div>
                      )}
                    </PlanWeekCollapsible>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
