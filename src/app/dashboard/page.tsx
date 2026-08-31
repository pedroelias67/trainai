import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { format, isToday, isTomorrow, subDays } from "date-fns";
import { pt } from "date-fns/locale";
import { LogoFull } from "@/components/ui/Logo";
import { RacePrediction } from "@/components/dashboard/RacePrediction";
import { WellnessCheckin } from "@/components/dashboard/WellnessCheckin";
import RecentActivitiesFeed from "@/components/dashboard/RecentActivitiesFeed";
import { OnboardingTour } from "@/components/dashboard/OnboardingTour";
import { WeeklyLoadChart, PaceEvolutionChart } from "@/components/dashboard/TrainingCharts";
import { sessionTypeLabel, sessionTypeDescription } from "@/lib/session-types";

async function getDashboardData(userId: string) {
  return prisma.athlete.findUnique({
    where: { userId },
    include: {
      user: { select: { name: true, email: true, createdAt: true } },
      events: { orderBy: { date: "asc" }, take: 3 },
      trainingPlans: {
        where: { status: "ACTIVE" },
        include: {
          event: true,
          // All of them: the dashboard needs whichever week today falls in, and
          // taking the first two by number meant it could only ever show week 1.
          weeks: {
            orderBy: { weekNumber: "asc" },
            include: { sessions: { orderBy: { date: "asc" } } },
          },
        },
        take: 1,
      },
      activities: {
        orderBy: { date: "desc" },
        take: 5,
        select: {
          id: true, sport: true, name: true, date: true,
          distance: true, duration: true, avgPace: true,
          avgHR: true, maxHR: true, calories: true,
          elevationGain: true, aerobicEffect: true, trainingLoad: true,
          gpsTrack: true, hrZones: true, splits: true,
        },
      },
    },
  });
}

async function getRunningActivities(athleteId: string) {
  return prisma.activity.findMany({
    where: {
      athleteId,
      sport: "RUNNING",
      date: { gte: subDays(new Date(), 60) },
      distance: { gt: 2000 },
    },
    select: { id: true, distance: true, duration: true, avgPace: true, date: true },
    orderBy: { date: "desc" },
    take: 20,
  });
}

async function getPersonalRecords(athleteId: string) {
  return prisma.personalRecord.findMany({
    where: { athleteId },
    orderBy: { distance: "asc" },
  });
}


const sportLabels: Record<string, string> = {
  RUNNING: "Corrida", CYCLING: "Ciclismo", SWIMMING: "Natação",
  TRIATHLON_SPRINT: "Triatlo Sprint", TRIATHLON_OLYMPIC: "Triatlo Olímpico",
  TRIATHLON_HALF: "Half Ironman", TRIATHLON_FULL: "Ironman",
};

const sportIcon: Record<string, string> = {
  RUNNING: "🏃", CYCLING: "🚴", SWIMMING: "🏊",
  TRIATHLON_SPRINT: "🏊🚴🏃", TRIATHLON_OLYMPIC: "🏊🚴🏃",
  TRIATHLON_HALF: "🏊🚴🏃", TRIATHLON_FULL: "🏊🚴🏃",
};

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("user_id")?.value;
  if (!userId) redirect("/auth/login");

  const athlete = await getDashboardData(userId);
  if (!athlete) redirect("/onboarding");

  const runningActivities = await getRunningActivities(athlete.id);
  const personalRecords = await getPersonalRecords(athlete.id);

  // Best recent pace from running activities
  function paceToSecs(pace: string | null): number | null {
    if (!pace) return null;
    const m = pace.match(/(\d+):(\d+)/);
    return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : null;
  }
  const recentWithPace = runningActivities.filter(a => a.avgPace && a.distance && a.distance > 5000);
  const bestRecentActivity = recentWithPace.sort((a, b) =>
    (paceToSecs(a.avgPace ?? null) ?? 999) - (paceToSecs(b.avgPace ?? null) ?? 999)
  )[0] ?? null;
  const recentBestPaceSec = bestRecentActivity ? paceToSecs(bestRecentActivity.avgPace ?? null) : null;
  const recentBestDistM = bestRecentActivity?.distance ?? null;

  const activePlan = athlete.trainingPlans[0];
  const now = new Date();

  // The week today actually falls in. plan.currentWeek is the fallback, since it
  // is maintained by a cron and can lag; the first week is the last resort.
  const currentWeek =
    activePlan?.weeks.find(w => new Date(w.startDate) <= now && now <= new Date(w.endDate)) ??
    activePlan?.weeks.find(w => w.weekNumber === activePlan.currentWeek) ??
    activePlan?.weeks[0];

  // A cancelled session is one the athlete removed: it belongs in neither the day
  // cards nor the week's totals. The plan page and calendar still list it struck
  // through, which is where restoring it lives.
  const weekSessions = currentWeek?.sessions.filter((s) => !s.cancelled) ?? [];

  // Today and tomorrow are read across every week, so the Sunday-to-Monday
  // boundary does not hide tomorrow's session.
  const allSessions = activePlan?.weeks.flatMap(w => w.sessions).filter(s => !s.cancelled) ?? [];
  const todaySessions = allSessions.filter((s) => isToday(new Date(s.date)));
  const tomorrowSessions = allSessions.filter((s) => isTomorrow(new Date(s.date)));

  const daysToEvent = activePlan
    ? Math.ceil((new Date(activePlan.event.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const completedThisWeek = weekSessions.filter((s) => s.completed).length;
  const totalThisWeek = weekSessions.length;

  // totalDistance is the figure the plan was generated with, so discount whatever
  // the athlete has cancelled since rather than recomputing it from the sessions.
  const cancelledDistance = currentWeek?.sessions
    .filter((s) => s.cancelled)
    .reduce((sum, s) => sum + (s.plannedDistance ?? 0), 0) ?? 0;
  const plannedDistanceThisWeek = currentWeek?.totalDistance != null
    ? Math.round(Math.max(0, currentWeek.totalDistance - cancelledDistance) * 10) / 10
    : null;

  // New user = registered in the last 7 days
  const isNewUser = athlete.user.createdAt
    ? (Date.now() - new Date(athlete.user.createdAt).getTime()) < 7 * 24 * 60 * 60 * 1000
    : false;

  const allActivities = athlete.activities.map(a => ({
    id: a.id,
    date: a.date.toISOString(),
    distance: a.distance,
    duration: a.duration,
    avgPace: a.avgPace,
    sport: a.sport,
  }));

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-[var(--border)] backdrop-blur-xl bg-[var(--bg-base)]/80 px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <LogoFull size={30} href="/dashboard" />
          <nav className="hidden md:flex items-center gap-1">
            {[
              { href: "/dashboard", label: "Dashboard" },
              { href: "/dashboard/plan", label: "Plano" },
              { href: "/dashboard/nutrition", label: "Nutrição" },
              { href: "/dashboard/calendar", label: "Calendário" },
              { href: "/dashboard/fitness", label: "Fitness" },
              { href: "/dashboard/activities", label: "Atividades" },
              { href: "/dashboard/shoes", label: "Sapatilhas" },
              { href: "/dashboard/zones", label: "Zonas" },
              { href: "/dashboard/chat", label: "Chat IA" },
              { href: "/dashboard/profile", label: "Perfil" },
            ].map((item) => (
              <Link key={item.href} href={item.href}
                className="px-4 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-4 text-sm text-[var(--text-muted)]">
            {athlete.user.email === (process.env.ADMIN_EMAIL ?? "pedroelias67@gmail.com") && (
              <Link href="/admin/users" className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] border border-[var(--border-hover)] px-2.5 py-1 rounded-lg transition-all">
                Admin
              </Link>
            )}
            Olá, <span className="text-white font-medium">{athlete.user.name?.split(" ")[0]}</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Strava banner */}
        {!athlete.stravaConnected ? (
          <div className="mb-6 flex items-center justify-between gap-4 p-4 rounded-2xl border border-orange-500/20 bg-orange-500/5">
            <div className="flex items-center gap-3">
              <svg viewBox="0 0 24 24" className="w-7 h-7 fill-orange-400 shrink-0">
                <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
              </svg>
              <div>
                <p className="text-orange-300 font-medium text-sm">Liga o Strava para sincronizar treinos automaticamente</p>
                <p className="text-orange-500/70 text-xs mt-0.5">Garmin sincroniza com Strava — dados chegam segundos após cada treino</p>
              </div>
            </div>
            <Link href="/api/strava/connect"
              className="shrink-0 bg-orange-500 hover:bg-orange-400 text-white text-sm px-4 py-2 rounded-xl font-medium transition-colors">
              Conectar →
            </Link>
          </div>
        ) : (
          <div className="mb-6 flex items-center gap-2 px-4 py-2.5 rounded-xl border border-green-500/15 bg-green-500/5 w-fit">
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-orange-400 shrink-0">
              <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
            </svg>
            <span className="text-green-400 text-xs font-medium">Strava conectado · sincronização automática ativa</span>
          </div>
        )}

        {!activePlan ? (
          <div className="card text-center py-20">
            <div className="text-5xl mb-4">🏃</div>
            <h2 className="text-xl font-bold text-white mb-2">Sem plano ativo</h2>
            <p className="text-[var(--text-muted)] text-sm mb-6">Cria um evento e gera o teu plano de treino personalizado</p>
            <Link href="/onboarding" className="btn-primary inline-block">Criar primeiro plano</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main column */}
            <div className="lg:col-span-2 space-y-6">

              {/* Today */}
              <div className="card">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="font-bold text-white text-lg">Hoje</h2>
                    <p className="text-[var(--text-muted)] text-xs mt-0.5 capitalize">
                      {format(new Date(), "EEEE, d 'de' MMMM", { locale: pt })}
                    </p>
                  </div>
                </div>
                {todaySessions.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-2xl mb-2">😴</p>
                    <p className="text-[var(--text-muted)] text-sm">Dia de descanso. Recupera bem!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {todaySessions.map((session) => (
                      <Link key={session.id} href={`/dashboard/session/${session.id}`}
                        className={`group flex items-center gap-4 p-4 rounded-xl border transition-all ${
                          session.completed
                            ? "border-green-500/20 bg-green-500/5"
                            : "border-[var(--border-hover)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-subtle)]"
                        }`}>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${
                          session.completed ? "bg-green-500/10" : "bg-[var(--bg-hover)]"
                        }`}>
                          {sportIcon[session.sport] ?? "🏃"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-white text-sm">{session.name}</p>
                          <p className="text-xs text-[var(--text-muted)] mt-0.5">
                            {sportLabels[session.sport]} · {sessionTypeLabel(session.sessionType)}
                            {session.plannedDistance ? ` · ${session.plannedDistance}km` : ""}
                            {session.plannedDuration ? ` · ${session.plannedDuration}min` : ""}
                          </p>
                        </div>
                        {session.completed ? (
                          <span className="text-green-400 text-xs font-medium shrink-0">✓ Concluído</span>
                        ) : (
                          <svg className="w-4 h-4 text-[var(--text-faint)] group-hover:text-[var(--text-secondary)] transition-colors shrink-0" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Tomorrow */}
              {tomorrowSessions.length > 0 && (
                <div className="card">
                  <h2 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-widest mb-4">Amanhã</h2>
                  <div className="space-y-2">
                    {tomorrowSessions.map((session) => (
                      <Link key={session.id} href={`/dashboard/session/${session.id}`}
                        className="group flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-subtle)] border border-transparent hover:border-[var(--border-hover)] hover:bg-[var(--bg-hover)] transition-all">
                        <span className="text-lg shrink-0">{sportIcon[session.sport] ?? "🏃"}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white">{session.name}</p>
                          <p className="text-xs text-[var(--text-muted)]">
                            {sessionTypeLabel(session.sessionType)}
                            {session.plannedDistance ? ` · ${session.plannedDistance}km` : ""}
                            {session.plannedDuration ? ` · ${session.plannedDuration}min` : ""}
                          </p>
                        </div>
                        <svg className="w-4 h-4 text-[var(--text-faint)] group-hover:text-[var(--text-secondary)] transition-colors shrink-0" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Race prediction */}
              {activePlan && (
                <RacePrediction
                  records={personalRecords.map(r => ({ distance: r.distance, timeSeconds: r.timeSeconds }))}
                  recentBestPaceSec={recentBestPaceSec}
                  recentBestDistM={recentBestDistM}
                  targetDistance={activePlan.event.distance}
                />
              )}

              {/* Recent activities feed */}
              <RecentActivitiesFeed activities={athlete.activities.map((a) => ({
                ...a,
                date: a.date.toISOString(),
              }))} />
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Target event */}
              <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] p-5">
                <div className="absolute inset-0 bg-gradient-to-br from-green-500/8 to-transparent pointer-events-none" />
                <p className="text-green-400 text-xs font-medium uppercase tracking-widest mb-3">Evento Alvo</p>
                <h3 className="font-bold text-white text-lg leading-tight mb-1">{activePlan.event.name}</h3>
                <p className="text-[var(--text-muted)] text-sm capitalize">
                  {format(new Date(activePlan.event.date), "d 'de' MMMM yyyy", { locale: pt })}
                </p>
                {daysToEvent !== null && (
                  <div className="mt-4 pt-4 border-t border-[var(--border)] flex items-end gap-4">
                    <div>
                      <p className="text-3xl font-bold text-white">{daysToEvent}</p>
                      <p className="text-[var(--text-muted)] text-xs">dias restantes</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-white">{activePlan.currentWeek}<span className="text-[var(--text-faint)] text-sm">/{activePlan.totalWeeks}</span></p>
                      <p className="text-[var(--text-muted)] text-xs">semana</p>
                    </div>
                  </div>
                )}
              </div>

              {/* This week */}
              {currentWeek && (
                <div className="card">
                  <h3 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-widest mb-3">Esta semana</h3>
                  {currentWeek.focus && (
                    <p className="text-[var(--text-secondary)] text-sm font-medium mb-3">{currentWeek.focus}</p>
                  )}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-[var(--bg-subtle)] rounded-xl p-3 text-center">
                      <p className="text-xl font-bold text-white">{plannedDistanceThisWeek ?? "—"}</p>
                      <p className="text-[var(--text-muted)] text-xs mt-0.5">km planeados</p>
                    </div>
                    <div className="bg-[var(--bg-subtle)] rounded-xl p-3 text-center">
                      <p className="text-xl font-bold text-white">{completedThisWeek}<span className="text-[var(--text-faint)] text-sm">/{totalThisWeek}</span></p>
                      <p className="text-[var(--text-muted)] text-xs mt-0.5">treinos</p>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="h-1.5 bg-[var(--bg-hover)] rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full transition-all"
                      style={{ width: totalThisWeek > 0 ? `${(completedThisWeek / totalThisWeek) * 100}%` : "0%" }} />
                  </div>
                </div>
              )}

              <WellnessCheckin />

              {/* Training charts */}
              {athlete.activities.length >= 3 && (
                <div className="space-y-3">
                  <WeeklyLoadChart activities={allActivities} />
                  <PaceEvolutionChart activities={allActivities} />
                </div>
              )}

              <Link href="/dashboard/plan"
                className="flex items-center justify-between p-4 rounded-2xl border border-[var(--border)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-card)] transition-all group">
                <span className="text-sm font-medium text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]">Ver plano completo</span>
                <svg className="w-4 h-4 text-[var(--text-faint)] group-hover:text-[var(--text-secondary)]" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </Link>
            </div>
          </div>
        )}
      </main>

      <OnboardingTour isNew={isNewUser} />
    </div>
  );
}
