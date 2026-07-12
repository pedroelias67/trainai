import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { LogoFull } from "@/components/ui/Logo";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths } from "date-fns";
import { pt } from "date-fns/locale";

const SESSION_TYPE_COLORS: Record<string, string> = {
  EASY: "bg-green-500/10 text-green-400 border-green-500/20",
  LONG: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  TEMPO: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  INTERVALS: "bg-red-500/10 text-red-400 border-red-500/20",
  RECOVERY: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  STRENGTH: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  BRICK: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  SWIM: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  RACE: "bg-rose-500/10 text-rose-400 border-rose-500/20",
};

const SESSION_TYPE_LABELS: Record<string, string> = {
  EASY: "Fácil", TEMPO: "Tempo", INTERVALS: "Intervalos", LONG: "Longo",
  RECOVERY: "Recuperação", STRENGTH: "Força", BRICK: "Brick", SWIM: "Natação", RACE: "Corrida",
};

const SPORT_ICON: Record<string, string> = {
  RUNNING: "🏃", CYCLING: "🚴", SWIMMING: "🏊",
};

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/plan", label: "Plano" },
  { href: "/dashboard/calendar", label: "Calendário" },
  { href: "/dashboard/fitness", label: "Fitness" },
  { href: "/dashboard/activities", label: "Atividades" },
  { href: "/dashboard/chat", label: "Chat IA" },
  { href: "/dashboard/profile", label: "Perfil" },
];

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const cookieStore = await cookies();
  const userId = cookieStore.get("user_id")?.value;
  if (!userId) redirect("/auth/login");

  const athlete = await prisma.athlete.findUnique({
    where: { userId },
    include: {
      trainingPlans: {
        where: { status: "ACTIVE" },
        include: {
          weeks: {
            include: { sessions: { orderBy: { date: "asc" } } },
          },
        },
        take: 1,
      },
      activities: { orderBy: { date: "desc" } },
    },
  });
  if (!athlete) redirect("/onboarding");

  const params = await searchParams;
  const today = new Date();
  const year = params.year ? parseInt(params.year) : today.getFullYear();
  const month = params.month ? parseInt(params.month) - 1 : today.getMonth();

  const currentMonth = new Date(year, month, 1);
  const prevMonth = subMonths(currentMonth, 1);
  const nextMonth = addMonths(currentMonth, 1);

  const prevMonthParams = `?month=${prevMonth.getMonth() + 1}&year=${prevMonth.getFullYear()}`;
  const nextMonthParams = `?month=${nextMonth.getMonth() + 1}&year=${nextMonth.getFullYear()}`;

  // All sessions from active plan
  const allSessions = athlete.trainingPlans[0]?.weeks.flatMap((w) => w.sessions) ?? [];

  // Calendar grid: start from Monday of first week
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days: Date[] = [];
  let d = calStart;
  while (d <= calEnd) {
    days.push(d);
    d = addDays(d, 1);
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <header className="sticky top-0 z-40 border-b border-[#1a1a1a] backdrop-blur-xl bg-black/60 px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <LogoFull size={30} />
          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <Link key={item.href} href={item.href}
                className={`px-4 py-2 rounded-lg text-sm transition-all ${
                  item.href === "/dashboard/calendar"
                    ? "text-white bg-white/10"
                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                }`}>
                {item.label}
              </Link>
            ))}
          </nav>
          <Link href="/dashboard" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">← Dashboard</Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white capitalize">
            {format(currentMonth, "MMMM yyyy", { locale: pt })}
          </h1>
          <div className="flex items-center gap-2">
            <Link href={`/dashboard/calendar${prevMonthParams}`}
              className="px-3 py-2 rounded-xl border border-[#2a2a2a] text-zinc-400 hover:text-white hover:border-[#3a3a3a] transition-all text-sm">
              ← Anterior
            </Link>
            <Link href={`/dashboard/calendar?month=${today.getMonth() + 1}&year=${today.getFullYear()}`}
              className="px-3 py-2 rounded-xl border border-[#2a2a2a] text-zinc-400 hover:text-white hover:border-[#3a3a3a] transition-all text-sm">
              Hoje
            </Link>
            <Link href={`/dashboard/calendar${nextMonthParams}`}
              className="px-3 py-2 rounded-xl border border-[#2a2a2a] text-zinc-400 hover:text-white hover:border-[#3a3a3a] transition-all text-sm">
              Próximo →
            </Link>
          </div>
        </div>

        {/* Day of week headers */}
        <div className="grid grid-cols-7 mb-2">
          {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((day) => (
            <div key={day} className="text-center text-xs font-medium text-zinc-500 py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isToday = isSameDay(day, today);
            const daySessions = allSessions.filter((s) => isSameDay(new Date(s.date), day));
            const dayActivities = athlete.activities.filter((a) => isSameDay(new Date(a.date), day));
            const hasActivityWithoutSession = dayActivities.length > 0 && daySessions.length === 0;

            return (
              <div key={day.toISOString()}
                className={`min-h-[100px] p-2 rounded-xl border transition-all ${
                  isToday
                    ? "border-green-500 bg-green-500/5"
                    : isCurrentMonth
                    ? "border-[#1f1f1f] bg-[#111]"
                    : "border-[#181818] bg-[#0d0d0d] opacity-40"
                }`}>
                <p className={`text-xs font-medium mb-1 ${
                  isToday ? "text-green-400" : isCurrentMonth ? "text-zinc-300" : "text-zinc-600"
                }`}>
                  {format(day, "d")}
                </p>

                <div className="space-y-1">
                  {daySessions.map((session) => (
                    <Link key={session.id} href={`/dashboard/session/${session.id}`}
                      className={`block text-xs px-1.5 py-1 rounded border truncate transition-all hover:opacity-80 ${
                        SESSION_TYPE_COLORS[session.sessionType] ?? "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                      }`}>
                      <span className="mr-1">{SPORT_ICON[session.sport] ?? "🏃"}</span>
                      {session.completed && <span className="text-green-400 mr-1">✓</span>}
                      {SESSION_TYPE_LABELS[session.sessionType] ?? session.name}
                    </Link>
                  ))}

                  {hasActivityWithoutSession && (
                    <div className="text-xs px-1.5 py-1 rounded border bg-zinc-800/30 text-zinc-500 border-zinc-700/30 truncate">
                      {SPORT_ICON[dayActivities[0].sport] ?? "🏃"} {dayActivities[0].name ?? "Atividade"}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-6 flex flex-wrap gap-3">
          {Object.entries(SESSION_TYPE_LABELS).map(([type, label]) => (
            <div key={type} className={`text-xs px-2 py-1 rounded border ${SESSION_TYPE_COLORS[type]}`}>
              {label}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
