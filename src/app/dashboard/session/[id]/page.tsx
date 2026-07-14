import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { LogoFull } from "@/components/ui/Logo";
import { GarminExportButton } from "@/components/dashboard/GarminHelpModal";
import { SessionJournal } from "@/components/dashboard/SessionJournal";
import NutritionPlan from "@/components/dashboard/NutritionPlan";

const sessionTypeColors: Record<string, string> = {
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

const sessionTypeLabels: Record<string, string> = {
  EASY: "Fácil", LONG: "Longo", TEMPO: "Tempo", INTERVALS: "Intervalos",
  RECOVERY: "Recuperação", STRENGTH: "Força", BRICK: "Brick", SWIM: "Natação", RACE: "Corrida",
};

const sportIcons: Record<string, string> = {
  RUNNING: "🏃", CYCLING: "🚴", SWIMMING: "🏊",
  TRIATHLON_SPRINT: "🏊🚴🏃", TRIATHLON_OLYMPIC: "🏊🚴🏃",
  TRIATHLON_HALF: "🏊🚴🏃", TRIATHLON_FULL: "🏊🚴🏃",
};

const zoneColors = ["bg-zinc-500", "bg-green-500", "bg-yellow-500", "bg-orange-500", "bg-red-500"];

export default async function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const userId = cookieStore.get("user_id")?.value;
  if (!userId) redirect("/auth/login");

  const athlete = await prisma.athlete.findUnique({ where: { userId } });
  if (!athlete) redirect("/onboarding");

  const session = await prisma.trainingSession.findUnique({
    where: { id },
    include: {
      week: { include: { plan: { include: { event: true } } } },
      activity: true,
    },
  });

  if (!session || session.week.plan.athleteId !== athlete.id) notFound();

  const zones = session.plannedZones as Record<string, number> | null;

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <header className="sticky top-0 z-40 border-b border-[var(--border)] backdrop-blur-xl bg-[var(--bg-base)]/80 px-6 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <LogoFull size={30} />
          <Link href="/dashboard" className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm transition-colors">← Dashboard</Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-5">
        {/* Session header */}
        <div className="card">
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{sportIcons[session.sport]}</span>
              <div>
                <h1 className="text-xl font-bold text-white">{session.name}</h1>
                <p className="text-[var(--text-muted)] text-sm capitalize">
                  {format(new Date(session.date), "EEEE, d 'de' MMMM", { locale: pt })}
                  {" · "}{session.week.plan.event.name}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <GarminExportButton sessionId={session.id} weekId={session.weekId} />
              <span className={`px-3 py-1 rounded-full text-xs font-medium border ${sessionTypeColors[session.sessionType] ?? "bg-zinc-500/10 text-[var(--text-secondary)] border-zinc-500/20"}`}>
                {sessionTypeLabels[session.sessionType]}
              </span>
            </div>
          </div>

          {/* Planned metrics */}
          <div className="grid grid-cols-3 gap-3 pt-5 border-t border-[var(--border)]">
            <div className="text-center bg-[var(--bg-subtle)] rounded-xl py-3">
              <p className="text-2xl font-bold text-white">{session.plannedDistance ?? "—"}</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">km planeados</p>
            </div>
            <div className="text-center bg-[var(--bg-subtle)] rounded-xl py-3">
              <p className="text-2xl font-bold text-white">{session.plannedDuration ?? "—"}</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">min planeados</p>
            </div>
            <div className="text-center bg-[var(--bg-subtle)] rounded-xl py-3">
              <p className="text-2xl font-bold text-white">{session.plannedPace ?? "—"}</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">pace alvo</p>
            </div>
          </div>

          {/* RPE & focus */}
          {(session.rpe || session.keyFocus) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
              {session.rpe && (
                <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-3">
                  <p className="text-xs font-medium text-blue-400 uppercase tracking-wide mb-1">Esforço Percebido (RPE)</p>
                  <p className="text-sm text-[var(--text-secondary)]">{session.rpe}</p>
                </div>
              )}
              {session.keyFocus && (
                <div className="bg-purple-500/5 border border-purple-500/15 rounded-xl p-3">
                  <p className="text-xs font-medium text-purple-400 uppercase tracking-wide mb-1">Foco Técnico</p>
                  <p className="text-sm text-[var(--text-secondary)]">{session.keyFocus}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Zone distribution */}
        {zones && (
          <div className="card">
            <h2 className="font-semibold text-white mb-4">Distribuição por Zonas</h2>
            <div className="space-y-3">
              {["z1", "z2", "z3", "z4", "z5"].map((z, i) => {
                const pct = zones[z] ?? 0;
                return (
                  <div key={z} className="flex items-center gap-3">
                    <span className="text-xs font-medium text-[var(--text-muted)] w-6">Z{i + 1}</span>
                    <div className="flex-1 bg-[var(--bg-hover)] rounded-full h-2.5">
                      <div className={`h-2.5 rounded-full ${zoneColors[i]}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-sm font-medium text-[var(--text-secondary)] w-10 text-right">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Workout structure */}
        <div className="card space-y-5">
          <h2 className="font-semibold text-white">Estrutura do Treino</h2>

          {session.warmup && (
            <div className="border-l-2 border-green-500 pl-4">
              <p className="text-xs font-semibold text-green-400 uppercase tracking-wide mb-1.5">Aquecimento</p>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{session.warmup}</p>
            </div>
          )}

          {session.mainSet && (
            <div className="border-l-2 border-blue-500 pl-4">
              <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide mb-1.5">Parte Principal</p>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{session.mainSet}</p>
            </div>
          )}

          {session.cooldown && (
            <div className="border-l-2 border-zinc-500 pl-4">
              <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-1.5">Arrefecimento</p>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{session.cooldown}</p>
            </div>
          )}
        </div>

        {/* Nutrition Plan */}
        <NutritionPlan sessionId={session.id} />

        {/* Coach tip */}
        {session.coachTip && (
          <div className="flex gap-3 p-4 rounded-2xl border border-yellow-500/20 bg-yellow-500/5">
            <span className="text-2xl shrink-0">💡</span>
            <div>
              <p className="text-xs font-semibold text-yellow-400 uppercase tracking-wide mb-1">Nota do Treinador</p>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{session.coachTip}</p>
            </div>
          </div>
        )}

        {/* Completed activity */}
        {session.activity ? (
          <div className="card border-green-500/20 bg-green-500/3">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-white">Atividade Realizada</h2>
              <span className="text-green-400 text-xs font-medium">✓ Concluído</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {session.activity.distance && (
                <div className="text-center bg-[var(--bg-subtle)] rounded-xl py-3">
                  <p className="text-xl font-bold text-white">{(session.activity.distance / 1000).toFixed(1)}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">km</p>
                </div>
              )}
              {session.activity.duration && (
                <div className="text-center bg-[var(--bg-subtle)] rounded-xl py-3">
                  <p className="text-xl font-bold text-white">{Math.round(session.activity.duration / 60)}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">min</p>
                </div>
              )}
              {session.activity.avgHR && (
                <div className="text-center bg-[var(--bg-subtle)] rounded-xl py-3">
                  <p className="text-xl font-bold text-white">{session.activity.avgHR}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">bpm FC</p>
                </div>
              )}
              {session.activity.avgPace && (
                <div className="text-center bg-[var(--bg-subtle)] rounded-xl py-3">
                  <p className="text-xl font-bold text-white">{session.activity.avgPace}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">pace</p>
                </div>
              )}
            </div>
            <Link href={`/dashboard/activity/${session.activity.id}`}
              className="mt-4 flex items-center justify-center gap-1 text-sm text-green-400 hover:text-green-300 font-medium transition-colors">
              Ver análise completa + mapa →
            </Link>
          </div>
        ) : (
          <div className="text-center py-8 rounded-2xl border border-dashed border-[var(--border-hover)]">
            <p className="text-[var(--text-faint)] text-sm">Ainda sem atividade registada para este treino</p>
            <p className="text-zinc-700 text-xs mt-1">Será preenchido automaticamente após sincronização Strava</p>
          </div>
        )}

        {/* Training journal */}
        <SessionJournal sessionId={session.id} initialNote={session.athleteNote ?? null} />
      </main>
    </div>
  );
}
