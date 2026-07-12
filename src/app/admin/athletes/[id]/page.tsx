import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { LogoFull } from "@/components/ui/Logo";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "pedroelias67@gmail.com";

async function requireAdmin() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("user_id")?.value;
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.email !== ADMIN_EMAIL) return null;
  return user;
}

const fitnessLabels: Record<string, string> = {
  BEGINNER: "Iniciante",
  INTERMEDIATE: "Intermédio",
  ADVANCED: "Avançado",
  ELITE: "Elite",
};

const statusColors: Record<string, string> = {
  ACTIVE: "text-green-400 bg-green-500/10 border-green-500/20",
  PAUSED: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  COMPLETED: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  CANCELLED: "text-red-400 bg-red-500/10 border-red-500/20",
  ARCHIVED: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20",
};

const statusLabels: Record<string, string> = {
  ACTIVE: "Ativo",
  PAUSED: "Pausado",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
  ARCHIVED: "Arquivado",
};

function formatPace(pace: string | null | undefined) {
  return pace ?? "—";
}

function formatDistance(meters: number | null | undefined) {
  if (meters == null) return "—";
  return `${Math.round((meters / 1000) * 10) / 10} km`;
}

function daysSince(date: Date | string) {
  const ms = Date.now() - new Date(date).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function relativeDate(date: Date | string) {
  const days = daysSince(date);
  if (days === 0) return "hoje";
  if (days === 1) return "ontem";
  return `há ${days} dias`;
}

export default async function AthleteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await requireAdmin();
  if (!admin) redirect("/dashboard");

  const { id } = await params;

  const athlete = await prisma.athlete.findUnique({
    where: { id },
    include: {
      user: true,
      events: { orderBy: { date: "asc" } },
      trainingPlans: {
        include: {
          event: true,
          weeks: {
            include: { sessions: true },
            orderBy: { weekNumber: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      activities: {
        orderBy: { date: "desc" },
        take: 20,
      },
    },
  });

  if (!athlete) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-zinc-500 text-sm">Atleta não encontrado.</div>
      </div>
    );
  }

  const activePlan = athlete.trainingPlans.find((p) => p.status === "ACTIVE") ?? null;
  const totalKm =
    Math.round(
      (athlete.activities.reduce((sum, a) => sum + (a.distance ?? 0), 0) / 1000) * 10
    ) / 10;
  const lastActivity = athlete.activities[0] ?? null;
  const currentWeekSessions = activePlan
    ? activePlan.weeks.find((w) => w.weekNumber === activePlan.currentWeek)?.sessions ?? []
    : [];
  const completedSessions = currentWeekSessions.filter((s) => s.completed).length;

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <header className="sticky top-0 z-40 border-b border-[#1a1a1a] backdrop-blur-xl bg-black/60 px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <LogoFull size={28} />
            <span className="text-zinc-600 text-xs font-mono px-2 py-0.5 rounded bg-[#1a1a1a] border border-[#2a2a2a]">
              admin
            </span>
          </div>
          <Link
            href="/admin/users"
            className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
          >
            ← Utilizadores
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div className="bg-[#111] border border-[#1f1f1f] rounded-2xl p-5">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-xl font-bold text-green-400 shrink-0">
              {athlete.user.name?.[0]?.toUpperCase() ?? athlete.user.email[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-white">
                {athlete.user.name ?? "Sem nome"}
              </h1>
              <p className="text-zinc-500 text-sm mt-0.5">{athlete.user.email}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="text-xs px-2 py-0.5 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] text-zinc-400">
                  {fitnessLabels[athlete.fitnessLevel] ?? athlete.fitnessLevel}
                </span>
                {athlete.stravaConnected && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400">
                    Strava ligado
                  </span>
                )}
                {athlete.garminConnected && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400">
                    Garmin ligado
                  </span>
                )}
                {athlete.user.emailVerified && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400">
                    Email verificado
                  </span>
                )}
              </div>
              <p className="text-zinc-600 text-xs mt-2">
                Registado em{" "}
                {new Date(athlete.createdAt).toLocaleDateString("pt-PT", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total de atividades", value: athlete.activities.length },
            { label: "Total km", value: `${totalKm} km` },
            {
              label: "Plano ativo",
              value: activePlan ? activePlan.name : "—",
            },
            {
              label: "Última atividade",
              value: lastActivity ? relativeDate(lastActivity.date) : "—",
            },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-[#111] border border-[#1f1f1f] rounded-2xl p-5"
            >
              <p className="text-zinc-500 text-xs">{s.label}</p>
              <p className="text-white text-lg font-bold mt-1 truncate">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Active plan */}
        {activePlan && (
          <div className="bg-[#111] border border-[#1f1f1f] rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4">Plano Ativo</h2>
            <div className="flex items-center justify-between mb-2">
              <p className="text-zinc-300 text-sm">{activePlan.name}</p>
              <span className="text-zinc-500 text-xs">
                Semana {activePlan.currentWeek} / {activePlan.totalWeeks}
              </span>
            </div>
            {/* Progress bar */}
            <div className="h-2 bg-[#1a1a1a] rounded-full overflow-hidden mb-4">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{
                  width: `${Math.round(
                    (activePlan.currentWeek / activePlan.totalWeeks) * 100
                  )}%`,
                }}
              />
            </div>
            {/* Current week sessions */}
            {currentWeekSessions.length > 0 && (
              <div>
                <p className="text-zinc-500 text-xs mb-2">
                  Sessões semana atual —{" "}
                  <span className="text-green-400">
                    {completedSessions}/{currentWeekSessions.length} concluídas
                  </span>
                </p>
                <div className="space-y-1.5">
                  {currentWeekSessions.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center gap-3 text-xs"
                    >
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                          s.completed
                            ? "bg-green-500/20 border-green-500/40"
                            : "bg-[#1a1a1a] border-[#2a2a2a]"
                        }`}
                      >
                        {s.completed && (
                          <span className="text-green-400 text-[10px]">✓</span>
                        )}
                      </div>
                      <span
                        className={
                          s.completed ? "text-zinc-400 line-through" : "text-zinc-300"
                        }
                      >
                        {s.name}
                      </span>
                      {s.plannedDistance && (
                        <span className="text-zinc-600">
                          {formatDistance(s.plannedDistance * 1000)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Recent activities */}
        <div className="bg-[#111] border border-[#1f1f1f] rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Atividades Recentes</h2>
          {athlete.activities.length === 0 ? (
            <p className="text-zinc-500 text-sm">Sem atividades registadas.</p>
          ) : (
            <div className="space-y-2">
              {athlete.activities.slice(0, 10).map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-4 py-2 border-b border-[#1a1a1a] last:border-0"
                >
                  <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-zinc-300 text-xs font-medium truncate">
                      {a.name ?? a.sport}
                    </p>
                    <p className="text-zinc-600 text-xs">
                      {new Date(a.date).toLocaleDateString("pt-PT")}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-zinc-300 text-xs">{formatDistance(a.distance)}</p>
                    {a.avgPace && (
                      <p className="text-zinc-600 text-xs">{formatPace(a.avgPace)}/km</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* All training plans */}
        <div className="bg-[#111] border border-[#1f1f1f] rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Todos os Planos</h2>
          {athlete.trainingPlans.length === 0 ? (
            <p className="text-zinc-500 text-sm">Sem planos de treino.</p>
          ) : (
            <div className="space-y-3">
              {athlete.trainingPlans.map((p) => (
                <div
                  key={p.id}
                  className="flex items-start gap-4 py-3 border-b border-[#1a1a1a] last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-zinc-200 text-sm font-medium">{p.name}</p>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border ${
                          statusColors[p.status] ?? statusColors.ARCHIVED
                        }`}
                      >
                        {statusLabels[p.status] ?? p.status}
                      </span>
                    </div>
                    <p className="text-zinc-500 text-xs mt-0.5">{p.event.name}</p>
                    <p className="text-zinc-600 text-xs mt-0.5">
                      {new Date(p.startDate).toLocaleDateString("pt-PT")} →{" "}
                      {new Date(p.endDate).toLocaleDateString("pt-PT")} ·{" "}
                      {p.totalWeeks} semanas
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
