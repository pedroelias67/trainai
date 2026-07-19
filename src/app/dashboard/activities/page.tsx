import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { LogoFull } from "@/components/ui/Logo";
import { SyncButton } from "@/components/dashboard/SyncButton";
import ActivitiesList from "@/components/dashboard/ActivitiesList";


export default async function ActivitiesPage() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("user_id")?.value;
  if (!userId) redirect("/auth/login");

  const athlete = await prisma.athlete.findUnique({
    where: { userId },
    include: {
      activities: {
        orderBy: { date: "desc" },
        take: 50,
        select: {
          id: true, sport: true, name: true, date: true,
          distance: true, duration: true, avgPace: true,
          avgHR: true, maxHR: true, elevationGain: true,
          calories: true, trainingLoad: true, aerobicEffect: true,
        },
      },
    },
  });

  if (!athlete) redirect("/onboarding");

  const activities = athlete.activities;

  const totalKm = activities.reduce((sum, a) => sum + (a.distance ? a.distance / 1000 : 0), 0);
  const totalTime = activities.reduce((sum, a) => sum + (a.duration ?? 0), 0);
  const totalHours = Math.floor(totalTime / 3600);

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
              { href: "/dashboard/activities", label: "Atividades" },
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
        <div className="flex items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Atividades</h1>
            <p className="text-[var(--text-muted)] text-sm mt-1">Histórico de treinos sincronizados via Strava</p>
          </div>
          {athlete.stravaConnected && <SyncButton />}
        </div>

        {/* Summary stats */}
        {activities.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="card text-center">
              <p className="text-2xl font-bold text-white">{activities.length}</p>
              <p className="text-[var(--text-muted)] text-xs mt-1">atividades</p>
            </div>
            <div className="card text-center">
              <p className="text-2xl font-bold text-white">{totalKm.toFixed(0)}</p>
              <p className="text-[var(--text-muted)] text-xs mt-1">km totais</p>
            </div>
            <div className="card text-center">
              <p className="text-2xl font-bold text-white">{totalHours}</p>
              <p className="text-[var(--text-muted)] text-xs mt-1">horas totais</p>
            </div>
          </div>
        )}

        {activities.length === 0 ? (
          <div className="card text-center py-20">
            <p className="text-4xl mb-4">⚡</p>
            <h2 className="text-xl font-bold text-white mb-2">Sem atividades ainda</h2>
            <p className="text-[var(--text-muted)] text-sm mb-2">Liga o Strava para sincronizar os teus treinos automaticamente</p>
            {!athlete.stravaConnected && (
              <Link href="/api/strava/connect" className="btn-primary inline-block mt-4">Conectar Strava</Link>
            )}
          </div>
        ) : (
          <ActivitiesList activities={activities.map((a) => ({ ...a, date: a.date.toISOString() }))} />
        )}
      </main>
    </div>
  );
}
