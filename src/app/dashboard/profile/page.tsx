import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { LogoFull } from "@/components/ui/Logo";

const fitnessLabels: Record<string, string> = {
  BEGINNER: "Iniciante", INTERMEDIATE: "Intermédio", ADVANCED: "Avançado", ELITE: "Elite",
};
const genderLabels: Record<string, string> = {
  MALE: "Masculino", FEMALE: "Feminino", OTHER: "Outro",
};

export default async function ProfilePage() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("user_id")?.value;
  if (!userId) redirect("/auth/login");

  const athlete = await prisma.athlete.findUnique({
    where: { userId },
    include: {
      user: true,
      events: { orderBy: { date: "asc" } },
      trainingPlans: {
        where: { status: "ACTIVE" },
        include: { event: true },
        take: 1,
      },
      activities: { orderBy: { date: "desc" }, take: 100 },
    },
  });

  if (!athlete) redirect("/onboarding");

  const totalKm = athlete.activities.reduce((sum, a) => sum + (a.distance ? a.distance / 1000 : 0), 0);
  const totalSessions = athlete.activities.length;
  const age = athlete.dateOfBirth
    ? Math.floor((Date.now() - new Date(athlete.dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
    : null;

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

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Profile card */}
        <div className="card">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-2xl font-bold text-green-400">
                {athlete.user.name?.[0]?.toUpperCase() ?? "A"}
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">{athlete.user.name}</h1>
                <p className="text-zinc-500 text-sm">{athlete.user.email}</p>
                {age && (
                  <p className="text-zinc-600 text-xs mt-0.5">
                    {age} anos · {genderLabels[athlete.gender ?? "MALE"]}
                    {athlete.fitnessLevel && ` · ${fitnessLabels[athlete.fitnessLevel]}`}
                  </p>
                )}
              </div>
            </div>
            <Link href="/dashboard/profile/edit" className="btn-secondary text-sm py-2 shrink-0">
              Editar
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="card text-center">
            <p className="text-2xl font-bold text-white">{totalKm.toFixed(0)}</p>
            <p className="text-zinc-500 text-xs mt-1">km totais</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-white">{totalSessions}</p>
            <p className="text-zinc-500 text-xs mt-1">atividades</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-white">{athlete.weeklyHours ?? "—"}</p>
            <p className="text-zinc-500 text-xs mt-1">h/semana</p>
          </div>
        </div>

        {/* Athlete details */}
        <div className="card">
          <h2 className="font-semibold text-white mb-4">Dados do atleta</h2>
          <div className="space-y-3">
            {[
              { label: "Nível", value: fitnessLabels[athlete.fitnessLevel ?? ""] ?? "—" },
              { label: "FC de repouso", value: athlete.restingHR ? `${athlete.restingHR} bpm` : "—" },
              { label: "FC máxima", value: athlete.maxHR ? `${athlete.maxHR} bpm` : "—" },
              { label: "FTP (ciclismo)", value: athlete.ftp ? `${athlete.ftp} W` : "—" },
              { label: "Pace limiar", value: athlete.ltPace ?? "—" },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between items-center py-2.5 border-b border-[#1a1a1a] last:border-0">
                <span className="text-zinc-500 text-sm">{label}</span>
                <span className="text-white text-sm font-medium">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Strava */}
        <div className="card">
          <h2 className="font-semibold text-white mb-4">Integrações</h2>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg viewBox="0 0 24 24" className="w-8 h-8 fill-orange-400 shrink-0">
                <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
              </svg>
              <div>
                <p className="text-white text-sm font-medium">Strava</p>
                <p className="text-zinc-500 text-xs">
                  {athlete.stravaConnected ? "Conectado · sincronização automática ativa" : "Não conectado"}
                </p>
              </div>
            </div>
            {athlete.stravaConnected ? (
              <span className="text-green-400 text-xs font-medium bg-green-500/10 border border-green-500/20 px-3 py-1 rounded-full">✓ Ativo</span>
            ) : (
              <Link href="/api/strava/connect" className="btn-primary text-xs py-2">Conectar</Link>
            )}
          </div>
        </div>

        {/* Events */}
        {athlete.events.length > 0 && (
          <div className="card">
            <h2 className="font-semibold text-white mb-4">Eventos</h2>
            <div className="space-y-3">
              {athlete.events.map((event) => (
                <div key={event.id} className="flex items-center justify-between py-2.5 border-b border-[#1a1a1a] last:border-0">
                  <div>
                    <p className="text-white text-sm font-medium">{event.name}</p>
                    <p className="text-zinc-500 text-xs capitalize">
                      {format(new Date(event.date), "d 'de' MMMM yyyy", { locale: pt })}
                    </p>
                  </div>
                  {athlete.trainingPlans[0]?.eventId === event.id && (
                    <span className="text-green-400 text-xs bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">Ativo</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Logout */}
        <div className="pt-2">
          <form action="/api/auth/logout" method="POST">
            <button type="submit"
              className="w-full py-3 rounded-xl border border-[#2a2a2a] text-zinc-500 hover:text-white hover:border-[#3a3a3a] text-sm transition-all">
              Terminar sessão
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
