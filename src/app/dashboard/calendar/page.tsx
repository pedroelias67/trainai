import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { LogoFull } from "@/components/ui/Logo";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths } from "date-fns";
import { pt } from "date-fns/locale";
import CalendarGrid from "@/components/dashboard/CalendarGrid";

const SESSION_TYPE_COLORS: Record<string, string> = {
  EASY: "bg-green-500/10 text-green-400 border-green-500/20",
  LONG: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  TEMPO: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  INTERVALS: "bg-red-500/10 text-red-400 border-red-500/20",
  RECOVERY: "bg-zinc-500/10 text-[var(--text-secondary)] border-zinc-500/20",
  STRENGTH: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  BRICK: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  SWIM: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  RACE: "bg-rose-500/10 text-rose-400 border-rose-500/20",
};

const SESSION_TYPE_LABELS: Record<string, string> = {
  EASY: "Fácil", TEMPO: "Tempo", INTERVALS: "Intervalos", LONG: "Longo",
  RECOVERY: "Recuperação", STRENGTH: "Força", BRICK: "Brick", SWIM: "Natação", RACE: "Corrida",
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
            include: {
              sessions: {
                orderBy: { date: "asc" },
                select: {
                  id: true, date: true, sport: true, sessionType: true,
                  name: true, completed: true, isPriority: true, cancelled: true,
                },
              },
            },
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
    <div className="min-h-screen bg-[var(--bg-base)]">
      <header className="sticky top-0 z-40 border-b border-[var(--border)] backdrop-blur-xl bg-black/60 px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <LogoFull size={30} />
          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <Link key={item.href} href={item.href}
                className={`px-4 py-2 rounded-lg text-sm transition-all ${
                  item.href === "/dashboard/calendar"
                    ? "text-white bg-white/10"
                    : "text-[var(--text-secondary)] hover:text-white hover:bg-white/5"
                }`}>
                {item.label}
              </Link>
            ))}
          </nav>
          <Link href="/dashboard" className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm transition-colors">← Dashboard</Link>
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
              className="px-3 py-2 rounded-xl border border-[var(--border-hover)] text-[var(--text-secondary)] hover:text-white hover:border-[var(--border-strong)] transition-all text-sm">
              ← Anterior
            </Link>
            <Link href={`/dashboard/calendar?month=${today.getMonth() + 1}&year=${today.getFullYear()}`}
              className="px-3 py-2 rounded-xl border border-[var(--border-hover)] text-[var(--text-secondary)] hover:text-white hover:border-[var(--border-strong)] transition-all text-sm">
              Hoje
            </Link>
            <Link href={`/dashboard/calendar${nextMonthParams}`}
              className="px-3 py-2 rounded-xl border border-[var(--border-hover)] text-[var(--text-secondary)] hover:text-white hover:border-[var(--border-strong)] transition-all text-sm">
              Próximo →
            </Link>
          </div>
        </div>

        {/* Day of week headers */}
        <div className="grid grid-cols-7 mb-2">
          {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((day) => (
            <div key={day} className="text-center text-xs font-medium text-[var(--text-muted)] py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid — drag & drop enabled */}
        <CalendarGrid
          days={days.map((d) => d.toISOString())}
          sessions={allSessions.map((s) => ({ ...s, date: new Date(s.date).toISOString() }))}
          activities={athlete.activities.map((a) => ({ ...a, date: new Date(a.date).toISOString() }))}
          currentMonth={currentMonth.toISOString()}
        />

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
