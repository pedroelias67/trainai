import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import EnrichedMap from "@/components/dashboard/EnrichedMap";
import ActivityShareCard from "@/components/dashboard/ActivityShareCard";
import { LogoFull } from "@/components/ui/Logo";
import { ShoeSelector } from "@/components/dashboard/ShoeSelector";

const sportLabels: Record<string, string> = {
  RUNNING: "Corrida", CYCLING: "Ciclismo", SWIMMING: "Natação",
};
const sportIcons: Record<string, string> = {
  RUNNING: "🏃", CYCLING: "🚴", SWIMMING: "🏊",
};
const zoneColors = ["bg-zinc-500", "bg-green-500", "bg-yellow-500", "bg-orange-500", "bg-red-500"];

export default async function ActivityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const userId = cookieStore.get("user_id")?.value;
  if (!userId) redirect("/auth/login");

  const athlete = await prisma.athlete.findUnique({ where: { userId } });
  if (!athlete) redirect("/onboarding");

  const activity = await prisma.activity.findUnique({
    where: { id },
    include: { sessions: { include: { week: { include: { plan: true } } } } },
  });

  const athleteShoes = await prisma.shoe.findMany({
    where: { athleteId: athlete.id },
    orderBy: [{ retired: "asc" }, { createdAt: "desc" }],
    select: { id: true, name: true, brand: true, retired: true },
  });

  if (!activity || activity.athleteId !== athlete.id) notFound();

  const hrZones = activity.hrZones as Record<string, number> | null;
  const splits = activity.splits as Array<{ km: number; pace: string; hr: number }> | null;
  const gpsTrack = activity.gpsTrack as Array<{ lat: number; lng: number; ele?: number; hr?: number; pace?: number }> | null;

  const topStats = [
    { label: "Distância", value: activity.distance ? `${(activity.distance / 1000).toFixed(2)} km` : "—" },
    { label: "Duração", value: activity.duration ? `${Math.floor(activity.duration / 3600)}h ${Math.floor((activity.duration % 3600) / 60)}min` : "—" },
    { label: "Pace Médio", value: activity.avgPace ?? "—" },
    { label: "FC Média", value: activity.avgHR ? `${activity.avgHR} bpm` : "—" },
    { label: "FC Máx", value: activity.maxHR ? `${activity.maxHR} bpm` : "—" },
  ];

  const extraStats = [
    { label: "Elevação", value: activity.elevationGain ? `+${Math.round(activity.elevationGain)}m` : "—" },
    { label: "Calorias", value: activity.calories ? `${activity.calories} kcal` : "—" },
    { label: "Carga de treino", value: activity.trainingLoad ? `${Math.round(activity.trainingLoad)}` : "—" },
    { label: "Efeito aeróbico", value: activity.aerobicEffect ? `${activity.aerobicEffect.toFixed(1)}` : "—" },
    { label: "Efeito anaeróbico", value: activity.anaerobicEffect ? `${activity.anaerobicEffect.toFixed(1)}` : "—" },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <header className="sticky top-0 z-40 border-b border-[#1a1a1a] backdrop-blur-xl bg-black/60 px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <LogoFull size={30} />
          <Link href="/dashboard/activities" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">← Atividades</Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-5">
        {/* Header */}
        <div className="card">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-4xl">{sportIcons[activity.sport]}</span>
            <div>
              <h1 className="text-xl font-bold text-white">
                {activity.name ?? sportLabels[activity.sport]}
              </h1>
              <p className="text-zinc-500 text-sm capitalize">
                {format(new Date(activity.date), "EEEE, d 'de' MMMM yyyy 'às' HH:mm", { locale: pt })}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {topStats.map((s) => (
              <div key={s.label} className="text-center bg-[#161616] rounded-xl py-3 px-2">
                <p className="text-lg font-bold text-white">{s.value}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Share Card */}
        <ActivityShareCard
          name={activity.name ?? "Atividade"}
          distance={activity.distance ? (activity.distance / 1000).toFixed(2) : null}
          duration={activity.duration ? `${Math.floor(activity.duration / 3600)}h ${Math.floor((activity.duration % 3600) / 60)}min` : null}
          avgPace={activity.avgPace ?? null}
          avgHR={activity.avgHR ?? null}
          date={activity.date.toISOString()}
          sport={activity.sport}
        />

        {/* Map */}
        {gpsTrack && gpsTrack.length > 0 ? (
          <div className="overflow-hidden rounded-2xl border border-[#222]">
            <div className="px-5 py-4 border-b border-[#1a1a1a] bg-[#111]">
              <h2 className="font-semibold text-white text-sm">Percurso</h2>
            </div>
            <EnrichedMap gpsTrack={gpsTrack} elevationGain={activity.elevationGain} />
          </div>
        ) : (
          <div className="text-center py-10 rounded-2xl border border-dashed border-[#2a2a2a]">
            <p className="text-zinc-600 text-sm">Sem dados GPS para esta atividade</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* HR zones */}
          {hrZones && (
            <div className="card">
              <h2 className="font-semibold text-white mb-4">Tempo por Zona de FC</h2>
              <div className="space-y-3">
                {["z1", "z2", "z3", "z4", "z5"].map((z, i) => {
                  const seconds = hrZones[z] ?? 0;
                  const totalSeconds = Object.values(hrZones).reduce((a: number, b) => a + (b as number), 0);
                  const pct = totalSeconds > 0 ? Math.round((seconds / totalSeconds) * 100) : 0;
                  const mins = Math.floor(seconds / 60);
                  return (
                    <div key={z}>
                      <div className="flex justify-between text-xs text-zinc-500 mb-1.5">
                        <span className="font-medium">Zona {i + 1}</span>
                        <span>{mins}min ({pct}%)</span>
                      </div>
                      <div className="bg-[#1a1a1a] rounded-full h-2">
                        <div className={`h-2 rounded-full ${zoneColors[i]}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Extra stats */}
          <div className="card">
            <h2 className="font-semibold text-white mb-4">Análise de Carga</h2>
            <div className="space-y-1">
              {extraStats.map((s) => (
                <div key={s.label} className="flex justify-between items-center py-2.5 border-b border-[#1a1a1a] last:border-0">
                  <span className="text-sm text-zinc-500">{s.label}</span>
                  <span className="text-sm font-medium text-white">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Splits */}
        {splits && splits.length > 0 && (
          <div className="card">
            <h2 className="font-semibold text-white mb-4">Splits por Km</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-zinc-600 uppercase tracking-wide border-b border-[#1a1a1a]">
                    <th className="pb-3">Km</th>
                    <th className="pb-3">Pace</th>
                    <th className="pb-3">FC Média</th>
                  </tr>
                </thead>
                <tbody>
                  {splits.map((split) => (
                    <tr key={split.km} className="border-b border-[#161616] hover:bg-[#161616] transition-colors">
                      <td className="py-2.5 font-medium text-white">{split.km}</td>
                      <td className="py-2.5 text-zinc-300">{split.pace}</td>
                      <td className="py-2.5 text-zinc-300">{split.hr ? `${split.hr} bpm` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Planned vs actual */}
        {activity.sessions.length > 0 && (
          <div className="card border-green-500/20 bg-green-500/3">
            <h2 className="font-semibold text-white mb-4">Planeado vs Realizado</h2>
            {activity.sessions.map((session) => (
              <div key={session.id} className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-zinc-500 mb-2">Planeado</p>
                  <p className="text-lg font-bold text-white">
                    {session.plannedDistance ? `${session.plannedDistance}km` : "—"}
                  </p>
                  <p className="text-xs text-zinc-500">{session.plannedPace ?? "—"}</p>
                </div>
                <div className="flex items-center justify-center text-zinc-700 text-xl font-light">vs</div>
                <div>
                  <p className="text-xs text-zinc-500 mb-2">Realizado</p>
                  <p className="text-lg font-bold text-white">
                    {activity.distance ? `${(activity.distance / 1000).toFixed(1)}km` : "—"}
                  </p>
                  <p className="text-xs text-zinc-500">{activity.avgPace ?? "—"}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        {/* Shoe selector */}
        <ShoeSelector
          activityId={activity.id}
          currentShoeId={activity.shoeId ?? null}
          shoes={athleteShoes}
        />
      </main>
    </div>
  );
}
