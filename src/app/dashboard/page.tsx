import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { format, isToday, isTomorrow, subDays } from "date-fns";
import { pt } from "date-fns/locale";
import { LogoFull } from "@/components/ui/Logo";
import { RacePrediction } from "@/components/dashboard/RacePrediction";

async function getDashboardData(userId: string) {
  return prisma.athlete.findUnique({
    where: { userId },
    include: {
      user: true,
      events: { orderBy: { date: "asc" }, take: 3 },
      trainingPlans: {
        where: { status: "ACTIVE" },
        include: {
          event: true,
          weeks: {
            orderBy: { weekNumber: "asc" },
            take: 2,
            include: { sessions: { orderBy: { date: "asc" } } },
          },
        },
        take: 1,
      },
      activities: { orderBy: { date: "desc" }, take: 5 },
    },
  });
}

async function getRunningActivities(athleteId: string) {
  return prisma.activity.findMany({
    where: {
      athleteId,
      sport: { in: ["RUNNING", "TRIATHLON_SPRINT", "TRIATHLON_OLYMPIC", "TRIATHLON_HALF", "TRIATHLON_FULL"] },
      date: { gte: subDays(new Date(), 30) },
    },
    select: { id: true, distance: true, duration: true, date: true },
    orderBy: { date: "desc" },
  });
}

const sessionTypeLabels: Record<string, string> = {
  EASY: "Fácil", TEMPO: "Tempo", INTERVALS: "Intervalos", LONG: "Longo",
  RECOVERY: "Recuperação", STRENGTH: "Força", BRICK: "Brick", SWIM: "Natação", RACE: "Corrida",
};

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

  const activePlan = athlete.trainingPlans[0];
  const currentWeek = activePlan?.weeks[0];
  const todaySessions = currentWeek?.sessions.filter((s) => isToday(new Date(s.date))) ?? [];
  const tomorrowSessions = currentWeek?.sessions.filter((s) => isTomorrow(new Date(s.date))) ?? [];

  const daysToEvent = activePlan
    ? Math.ceil((new Date(activePlan.event.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const completedThisWeek = currentWeek?.sessions.filter((s) => s.completed).length ?? 0;
  const totalThisWeek = currentWeek?.sessions.length ?? 0;

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-[#1a1a1a] backdrop-blur-xl bg-black/60 px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <LogoFull size={30} />
          <nav className="hidden md:flex items-center gap-1">
            {[
              { href: "/dashboard", label: "Dashboard" },
              { href: "/dashboard/plan", label: "Plano" },
              { href: "/dashboard/calendar", label: "Calendário" },
              { href: "/dashboard/fitness", label: "Fitness" },
              { href: "/dashboard/activities", label: "Atividades" },
              { href: "/dashboard/shoes", label: "Sapatilhas" },
              { href: "/dashboard/zones", label: "Zonas" },
              { href: "/dashboard/chat", label: "Chat IA" },
              { href: "/dashboard/profile", label: "Perfil" },
            ].map((item) => (
              <Link key={item.href} href={item.href}
                className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-white/5 transition-all">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-4 text-sm text-zinc-500">
            {athlete.user.email === (process.env.ADMIN_EMAIL ?? "pedroelias67@gmail.com") && (
              <Link href="/admin/users" className="text-xs text-zinc-500 hover:text-zinc-300 border border-[#2a2a2a] px-2.5 py-1 rounded-lg transition-all">
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
            <p className="text-zinc-500 text-sm mb-6">Cria um evento e gera o teu plano de treino personalizado</p>
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
                    <p className="text-zinc-500 text-xs mt-0.5 capitalize">
                      {format(new Date(), "EEEE, d 'de' MMMM", { locale: pt })}
                    </p>
                  </div>
                </div>
                {todaySessions.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-2xl mb-2">😴</p>
                    <p className="text-zinc-500 text-sm">Dia de descanso. Recupera bem!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {todaySessions.map((session) => (
                      <Link key={session.id} href={`/dashboard/session/${session.id}`}
                        className={`group flex items-center gap-4 p-4 rounded-xl border transition-all ${
                          session.completed
                            ? "border-green-500/20 bg-green-500/5"
                            : "border-[#2a2a2a] hover:border-[#3a3a3a] hover:bg-[#161616]"
                        }`}>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${
                          session.completed ? "bg-green-500/10" : "bg-[#1a1a1a]"
                        }`}>
                          {sportIcon[session.sport] ?? "🏃"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-white text-sm">{session.name}</p>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            {sportLabels[session.sport]} · {sessionTypeLabels[session.sessionType]}
                            {session.plannedDistance ? ` · ${session.plannedDistance}km` : ""}
                            {session.plannedDuration ? ` · ${session.plannedDuration}min` : ""}
                          </p>
                        </div>
                        {session.completed ? (
                          <span className="text-green-400 text-xs font-medium shrink-0">✓ Concluído</span>
                        ) : (
                          <svg className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors shrink-0" viewBox="0 0 20 20" fill="currentColor">
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
                  <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-widest mb-4">Amanhã</h2>
                  <div className="space-y-2">
                    {tomorrowSessions.map((session) => (
                      <div key={session.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#161616]">
                        <span className="text-lg">{sportIcon[session.sport] ?? "🏃"}</span>
                        <div>
                          <p className="text-sm font-medium text-white">{session.name}</p>
                          <p className="text-xs text-zinc-500">
                            {session.plannedDistance ? `${session.plannedDistance}km` : ""}
                            {session.plannedDuration ? ` · ${session.plannedDuration}min` : ""}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Race prediction */}
              <RacePrediction recentActivities={runningActivities.map((a) => ({
                id: a.id,
                distance: a.distance,
                duration: a.duration,
                date: a.date.toISOString(),
              }))} />

              {/* Recent activities */}
              {athlete.activities.length > 0 && (
                <div className="card">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-bold text-white">Atividades Recentes</h2>
                    <Link href="/dashboard/activities" className="text-xs text-zinc-500 hover:text-zinc-300">Ver todas →</Link>
                  </div>
                  <div className="space-y-1">
                    {athlete.activities.map((activity) => (
                      <Link key={activity.id} href={`/dashboard/activity/${activity.id}`}
                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#161616] transition-colors group">
                        <span className="text-lg">{sportIcon[activity.sport] ?? "🏃"}</span>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-white">{activity.name ?? sportLabels[activity.sport]}</p>
                          <p className="text-xs text-zinc-500">
                            {format(new Date(activity.date), "d MMM", { locale: pt })}
                            {activity.distance ? ` · ${(activity.distance / 1000).toFixed(1)}km` : ""}
                            {activity.avgHR ? ` · ${activity.avgHR}bpm` : ""}
                          </p>
                        </div>
                        <svg className="w-4 h-4 text-zinc-700 group-hover:text-zinc-500 transition-colors" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Target event */}
              <div className="relative overflow-hidden rounded-2xl border border-[#222] p-5">
                <div className="absolute inset-0 bg-gradient-to-br from-green-500/8 to-transparent pointer-events-none" />
                <p className="text-green-400 text-xs font-medium uppercase tracking-widest mb-3">Evento Alvo</p>
                <h3 className="font-bold text-white text-lg leading-tight mb-1">{activePlan.event.name}</h3>
                <p className="text-zinc-500 text-sm capitalize">
                  {format(new Date(activePlan.event.date), "d 'de' MMMM yyyy", { locale: pt })}
                </p>
                {daysToEvent !== null && (
                  <div className="mt-4 pt-4 border-t border-[#222] flex items-end gap-4">
                    <div>
                      <p className="text-3xl font-bold text-white">{daysToEvent}</p>
                      <p className="text-zinc-500 text-xs">dias restantes</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-white">{activePlan.currentWeek}<span className="text-zinc-600 text-sm">/{activePlan.totalWeeks}</span></p>
                      <p className="text-zinc-500 text-xs">semana</p>
                    </div>
                  </div>
                )}
              </div>

              {/* This week */}
              {currentWeek && (
                <div className="card">
                  <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-widest mb-3">Esta semana</h3>
                  {currentWeek.focus && (
                    <p className="text-zinc-300 text-sm font-medium mb-3">{currentWeek.focus}</p>
                  )}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-[#161616] rounded-xl p-3 text-center">
                      <p className="text-xl font-bold text-white">{currentWeek.totalDistance ?? "—"}</p>
                      <p className="text-zinc-500 text-xs mt-0.5">km planeados</p>
                    </div>
                    <div className="bg-[#161616] rounded-xl p-3 text-center">
                      <p className="text-xl font-bold text-white">{completedThisWeek}<span className="text-zinc-600 text-sm">/{totalThisWeek}</span></p>
                      <p className="text-zinc-500 text-xs mt-0.5">treinos</p>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full transition-all"
                      style={{ width: totalThisWeek > 0 ? `${(completedThisWeek / totalThisWeek) * 100}%` : "0%" }} />
                  </div>
                </div>
              )}

              <Link href="/dashboard/plan"
                className="flex items-center justify-between p-4 rounded-2xl border border-[#222] hover:border-[#333] hover:bg-[#111] transition-all group">
                <span className="text-sm font-medium text-zinc-300 group-hover:text-white">Ver plano completo</span>
                <svg className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
