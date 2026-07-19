import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { LogoFull } from "@/components/ui/Logo";
import { format, subDays, isSameDay, startOfWeek } from "date-fns";
import { pt } from "date-fns/locale";
import { FitnessChart } from "@/components/dashboard/FitnessChart";
import { PersonalRecords } from "@/components/dashboard/PersonalRecords";
import { ProgressionChart } from "@/components/dashboard/ProgressionChart";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/plan", label: "Plano" },
  { href: "/dashboard/calendar", label: "Calendário" },
  { href: "/dashboard/fitness", label: "Fitness" },
  { href: "/dashboard/activities", label: "Atividades" },
  { href: "/dashboard/chat", label: "Chat IA" },
  { href: "/dashboard/profile", label: "Perfil" },
];

// Estimate TSS from activity (simplified pace-based)
function estimateTSS(duration: number | null, avgHR: number | null): number {
  if (!duration || duration <= 0) return 0;
  const hours = duration / 3600;

  // Use HR-based intensity if available
  if (avgHR && avgHR > 0) {
    let intensityFactor: number;
    if (avgHR < 120) intensityFactor = 0.65; // easy
    else if (avgHR < 145) intensityFactor = 0.75; // moderate
    else if (avgHR < 165) intensityFactor = 0.85; // tempo
    else intensityFactor = 0.95; // hard
    return hours * intensityFactor * intensityFactor * 100;
  }

  // Default: assume moderate effort (70/hr)
  return hours * 70;
}

export default async function FitnessPage() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("user_id")?.value;
  if (!userId) redirect("/auth/login");

  const athlete = await prisma.athlete.findUnique({
    where: { userId },
    include: {
      activities: {
        where: {
          date: { gte: subDays(new Date(), 90) },
        },
        orderBy: { date: "asc" },
        select: { date: true, duration: true, avgHR: true, sport: true, avgPace: true, distance: true },
      },
    },
  });
  if (!athlete) redirect("/onboarding");

  const personalRecords = await prisma.personalRecord.findMany({
    where: { athleteId: athlete.id },
    orderBy: { distance: "asc" },
  });

  // Build daily TSS for last 90 days
  const today = new Date();
  const ninetyDaysAgo = subDays(today, 90);

  type DailyTSS = { date: Date; tss: number };
  const dailyTSSMap: DailyTSS[] = [];
  for (let i = 90; i >= 0; i--) {
    const day = subDays(today, i);
    const dayActivities = athlete.activities.filter((a) => isSameDay(new Date(a.date), day));
    const tss = dayActivities.reduce((sum, a) => sum + estimateTSS(a.duration, a.avgHR), 0);
    dailyTSSMap.push({ date: day, tss });
  }

  // Calculate CTL (42-day EMA) and ATL (7-day EMA)
  const ctlDecay = Math.exp(-1 / 42);
  const atlDecay = Math.exp(-1 / 7);

  let ctl = 0;
  let atl = 0;

  // Run through all 90 days to build up initial CTL/ATL
  const chartData: { date: string; ctl: number; atl: number; tsb: number }[] = [];

  for (let i = 0; i < dailyTSSMap.length; i++) {
    const { date, tss } = dailyTSSMap[i];
    ctl = ctl * ctlDecay + tss * (1 - ctlDecay);
    atl = atl * atlDecay + tss * (1 - atlDecay);
    const tsb = ctl - atl;

    // Only include last 60 days in chart
    if (i >= 30) {
      chartData.push({
        date: format(date, "dd/MM"),
        ctl: parseFloat(ctl.toFixed(1)),
        atl: parseFloat(atl.toFixed(1)),
        tsb: parseFloat(tsb.toFixed(1)),
      });
    }
  }

  const todayData = chartData[chartData.length - 1] ?? { ctl: 0, atl: 0, tsb: 0 };

  // Build weekly progression data (pace + HR) for running activities
  function paceToSeconds(pace: string | null): number | null {
    if (!pace) return null;
    const match = pace.match(/(\d+):(\d+)/);
    if (!match) return null;
    return parseInt(match[1]) * 60 + parseInt(match[2]);
  }
  function secondsToPace(s: number): string {
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}/km`;
  }

  const runningActivities = athlete.activities.filter(
    (a) => a.sport === "RUNNING" && a.avgPace && a.distance && a.distance > 2000
  );

  // Group by week
  const weekMap = new Map<string, { paceSecs: number[]; hrs: number[]; km: number }>();
  for (const a of runningActivities) {
    const weekStart = startOfWeek(new Date(a.date), { weekStartsOn: 1 });
    const key = format(weekStart, "dd/MM", { locale: pt });
    if (!weekMap.has(key)) weekMap.set(key, { paceSecs: [], hrs: [], km: 0 });
    const entry = weekMap.get(key)!;
    const ps = paceToSeconds(a.avgPace ?? null);
    if (ps) entry.paceSecs.push(ps);
    if (a.avgHR) entry.hrs.push(a.avgHR);
    entry.km += (a.distance ?? 0) / 1000;
  }

  const progressionData = Array.from(weekMap.entries()).map(([week, v]) => {
    const avgPaceSec = v.paceSecs.length ? Math.round(v.paceSecs.reduce((a, b) => a + b) / v.paceSecs.length) : null;
    const avgHR = v.hrs.length ? Math.round(v.hrs.reduce((a, b) => a + b) / v.hrs.length) : null;
    return {
      week,
      avgPaceSec,
      avgHR,
      km: Math.round(v.km * 10) / 10,
      paceLabel: avgPaceSec ? secondsToPace(avgPaceSec) : null,
    };
  });

  void ninetyDaysAgo;

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <header className="sticky top-0 z-40 border-b border-[var(--border)] backdrop-blur-xl bg-[var(--bg-base)]/80 px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <LogoFull size={30} />
          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <Link key={item.href} href={item.href}
                className={`px-4 py-2 rounded-lg text-sm transition-all ${
                  item.href === "/dashboard/fitness"
                    ? "text-white bg-white/10"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                }`}>
                {item.label}
              </Link>
            ))}
          </nav>
          <Link href="/dashboard" className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm transition-colors">← Dashboard</Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Dashboard de Fitness</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            Carga de treino, fadiga e forma dos últimos 90 dias
          </p>
        </div>

        <PersonalRecords records={personalRecords.map((r) => ({
          id: r.id,
          distance: r.distance,
          timeSeconds: r.timeSeconds,
          pace: r.pace,
          date: r.date.toISOString(),
          activityId: r.activityId,
        }))} />

        <FitnessChart
          data={chartData}
          todayCTL={todayData.ctl}
          todayATL={todayData.atl}
          todayTSB={todayData.tsb}
        />

        <div className="mt-6">
          <ProgressionChart data={progressionData} />
        </div>
      </main>
    </div>
  );
}
