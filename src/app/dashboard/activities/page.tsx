import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { LogoFull } from "@/components/ui/Logo";
import { SyncButton } from "@/components/dashboard/SyncButton";

const sportLabels: Record<string, string> = {
  RUNNING: "Corrida", CYCLING: "Ciclismo", SWIMMING: "Natação",
};
const sportIcon: Record<string, string> = {
  RUNNING: "🏃", CYCLING: "🚴", SWIMMING: "🏊",
};

export default async function ActivitiesPage() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("user_id")?.value;
  if (!userId) redirect("/auth/login");

  const athlete = await prisma.athlete.findUnique({
    where: { userId },
    include: {
      activities: { orderBy: { date: "desc" }, take: 50 },
    },
  });

  if (!athlete) redirect("/onboarding");

  const activities = athlete.activities;

  const totalKm = activities.reduce((sum, a) => sum + (a.distance ? a.distance / 1000 : 0), 0);
  const totalTime = activities.reduce((sum, a) => sum + (a.duration ?? 0), 0);
  const totalHours = Math.floor(totalTime / 3600);

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <header className="sticky top-0 z-40 border-b border-[#1a1a1a] backdrop-blur-xl bg-black/60 px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <LogoFull size={30} />
          <nav className="hidden md:flex items-center gap-1">
            {[
              { href: "/dashboard", label: "Dashboard" },
              { href: "/dashboard/plan", label: "Plano" },
              { href: "/dashboard/activities", label: "Atividades" },
              { href: "/dashboard/profile", label: "Perfil" },
            ].map((item) => (
              <Link key={item.href} href={item.href}
                className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-white/5 transition-all">
                {item.label}
              </Link>
            ))}
          </nav>
          <Link href="/dashboard" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">← Dashboard</Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Atividades</h1>
            <p className="text-zinc-500 text-sm mt-1">Histórico de treinos sincronizados via Strava</p>
          </div>
          {athlete.stravaConnected && <SyncButton />}
        </div>

        {/* Summary stats */}
        {activities.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="card text-center">
              <p className="text-2xl font-bold text-white">{activities.length}</p>
              <p className="text-zinc-500 text-xs mt-1">atividades</p>
            </div>
            <div className="card text-center">
              <p className="text-2xl font-bold text-white">{totalKm.toFixed(0)}</p>
              <p className="text-zinc-500 text-xs mt-1">km totais</p>
            </div>
            <div className="card text-center">
              <p className="text-2xl font-bold text-white">{totalHours}</p>
              <p className="text-zinc-500 text-xs mt-1">horas totais</p>
            </div>
          </div>
        )}

        {activities.length === 0 ? (
          <div className="card text-center py-20">
            <p className="text-4xl mb-4">⚡</p>
            <h2 className="text-xl font-bold text-white mb-2">Sem atividades ainda</h2>
            <p className="text-zinc-500 text-sm mb-2">Liga o Strava para sincronizar os teus treinos automaticamente</p>
            {!athlete.stravaConnected && (
              <Link href="/api/strava/connect" className="btn-primary inline-block mt-4">Conectar Strava</Link>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {activities.map((activity) => (
              <Link key={activity.id} href={`/dashboard/activity/${activity.id}`}
                className="group flex items-center gap-4 p-4 rounded-2xl border border-[#1f1f1f] hover:border-[#2a2a2a] hover:bg-[#111] transition-all">
                <div className="w-10 h-10 bg-[#1a1a1a] rounded-xl flex items-center justify-center text-lg shrink-0">
                  {sportIcon[activity.sport] ?? "🏃"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white text-sm">{activity.name ?? sportLabels[activity.sport]}</p>
                  <p className="text-xs text-zinc-500 mt-0.5 capitalize">
                    {format(new Date(activity.date), "EEEE, d 'de' MMMM yyyy", { locale: pt })}
                  </p>
                </div>
                <div className="hidden sm:flex items-center gap-6 text-right">
                  {activity.distance && (
                    <div>
                      <p className="text-sm font-semibold text-white">{(activity.distance / 1000).toFixed(1)} km</p>
                      <p className="text-xs text-zinc-600">distância</p>
                    </div>
                  )}
                  {activity.avgPace && (
                    <div>
                      <p className="text-sm font-semibold text-white">{activity.avgPace}</p>
                      <p className="text-xs text-zinc-600">pace</p>
                    </div>
                  )}
                  {activity.avgHR && (
                    <div>
                      <p className="text-sm font-semibold text-white">{activity.avgHR} bpm</p>
                      <p className="text-xs text-zinc-600">FC média</p>
                    </div>
                  )}
                  {activity.duration && (
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {Math.floor(activity.duration / 3600) > 0
                          ? `${Math.floor(activity.duration / 3600)}h${Math.floor((activity.duration % 3600) / 60)}min`
                          : `${Math.floor(activity.duration / 60)}min`}
                      </p>
                      <p className="text-xs text-zinc-600">duração</p>
                    </div>
                  )}
                </div>
                <svg className="w-4 h-4 text-zinc-700 group-hover:text-zinc-500 transition-colors shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
