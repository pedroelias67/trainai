import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { LogoFull } from "@/components/ui/Logo";
import NotificationSettings from "@/components/dashboard/NotificationSettings";
import ThemeToggle from "@/components/dashboard/ThemeToggle";
import { DeleteAccount } from "@/components/dashboard/DeleteAccount";
import { WatchCompatibility } from "@/components/dashboard/WatchCompatibility";
import { IntervalsConnect } from "@/components/dashboard/IntervalsConnect";
import { RacesCard } from "@/components/dashboard/RacesCard";
import { StravaConnection } from "@/components/dashboard/StravaConnection";
import { getSessionUserId } from "@/lib/session";

const fitnessLabels: Record<string, string> = {
  BEGINNER: "Iniciante", INTERMEDIATE: "Intermédio", ADVANCED: "Avançado", ELITE: "Elite",
};
const genderLabels: Record<string, string> = {
  MALE: "Masculino", FEMALE: "Feminino", OTHER: "Outro",
};

export default async function ProfilePage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/auth/login");

  const athlete = await prisma.athlete.findUnique({
    where: { userId },
    include: {
      user: true,
      // The plan count decides whether a race can be removed at all: a plan
      // points at its event, so an event with one cannot be deleted.
      events: { orderBy: { date: "asc" }, include: { _count: { select: { trainingPlans: true } } } },
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
    <div className="min-h-screen bg-[var(--bg-base)]">
      <header className="sticky top-0 z-40 border-b border-[var(--border)] backdrop-blur-xl bg-[var(--bg-base)]/60 px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <LogoFull size={30} href="/dashboard" />
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

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Profile card */}
        <div className="card">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-2xl font-bold text-green-400">
                {athlete.user.name?.[0]?.toUpperCase() ?? "A"}
              </div>
              <div>
                <h1 className="text-lg font-bold text-[var(--text-primary)]">{athlete.user.name}</h1>
                <p className="text-[var(--text-muted)] text-sm">{athlete.user.email}</p>
                {age && (
                  <p className="text-[var(--text-faint)] text-xs mt-0.5">
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
            <p className="text-2xl font-bold text-[var(--text-primary)]">{totalKm.toFixed(0)}</p>
            <p className="text-[var(--text-muted)] text-xs mt-1">km totais</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-[var(--text-primary)]">{totalSessions}</p>
            <p className="text-[var(--text-muted)] text-xs mt-1">atividades</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-[var(--text-primary)]">{athlete.weeklyHours ?? "—"}</p>
            <p className="text-[var(--text-muted)] text-xs mt-1">h/semana</p>
          </div>
        </div>

        {/* Athlete details */}
        <div className="card">
          <h2 className="font-semibold text-[var(--text-primary)] mb-4">Dados do atleta</h2>
          <div className="space-y-3">
            {[
              { label: "Nível", value: fitnessLabels[athlete.fitnessLevel ?? ""] ?? "—" },
              { label: "FC de repouso", value: athlete.restingHR ? `${athlete.restingHR} bpm` : "—" },
              { label: "FC máxima", value: athlete.maxHR ? `${athlete.maxHR} bpm` : "—" },
              { label: "FTP (ciclismo)", value: athlete.ftp ? `${athlete.ftp} W` : "—" },
              { label: "Pace limiar", value: athlete.ltPace ?? "—" },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between items-center py-2.5 border-b border-[var(--border)] last:border-0">
                <span className="text-[var(--text-muted)] text-sm">{label}</span>
                <span className="text-[var(--text-primary)] text-sm font-medium">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Strava */}
        <div className="card">
          <h2 className="font-semibold text-[var(--text-primary)] mb-4">Integrações</h2>
          <StravaConnection
            connected={athlete.stravaConnected}
            athleteName={athlete.stravaAthleteName}
            athleteId={athlete.stravaAthleteId}
          />
          <IntervalsConnect connected={!!athlete.intervalsIcuApiKey} />

          <div className="mt-4">
            <WatchCompatibility />
          </div>
        </div>

        {/* Races: the goal, and the ones on the way to it */}
        <RacesCard
          races={athlete.events.map(event => ({
            id: event.id,
            name: event.name,
            date: event.date.toISOString(),
            sport: event.sport,
            distance: event.distance,
            priority: event.priority,
            hasPlans: event._count.trainingPlans > 0,
          }))}
          targetEventId={athlete.trainingPlans[0]?.eventId ?? null}
        />

        {/* Logout */}
        <div className="pt-2">
          <form action="/api/auth/logout" method="POST">
            <button type="submit"
              className="w-full py-3 rounded-xl border border-[var(--border-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] text-sm transition-all">
              Terminar sessão
            </button>
          </form>
        </div>

        {/* Privacy & Data */}
        <div className="card space-y-4">
          <h2 className="font-semibold text-[var(--text-primary)]">Privacidade e Dados</h2>
          <div className="flex gap-4 text-xs text-[var(--text-muted)]">
            <Link href="/privacy" className="hover:text-[var(--text-secondary)] transition-colors underline underline-offset-2">
              Política de Privacidade
            </Link>
            <Link href="/terms" className="hover:text-[var(--text-secondary)] transition-colors underline underline-offset-2">
              Termos de Serviço
            </Link>
          </div>
          <div className="pt-1">
            <DeleteAccount />
          </div>
        </div>

        <NotificationSettings />

        {/* Appearance */}
        <div className="card">
          <h2 className="font-semibold text-[var(--text-primary)] mb-4">Aparência</h2>
          <ThemeToggle />
        </div>
      </main>
    </div>
  );
}
