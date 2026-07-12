import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { LogoFull } from "@/components/ui/Logo";
import { calculateHRZones, calculatePaceZones } from "@/lib/training-zones";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/plan", label: "Plano" },
  { href: "/dashboard/calendar", label: "Calendário" },
  { href: "/dashboard/fitness", label: "Fitness" },
  { href: "/dashboard/activities", label: "Atividades" },
  { href: "/dashboard/shoes", label: "Sapatilhas" },
  { href: "/dashboard/zones", label: "Zonas" },
  { href: "/dashboard/chat", label: "Chat IA" },
  { href: "/dashboard/profile", label: "Perfil" },
];

export default async function ZonesPage() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("user_id")?.value;
  if (!userId) redirect("/auth/login");

  const athlete = await prisma.athlete.findUnique({
    where: { userId },
    select: { maxHR: true, restingHR: true, ltPace: true },
  });
  if (!athlete) redirect("/onboarding");

  const hrZones = athlete.maxHR ? calculateHRZones(athlete.maxHR, athlete.restingHR ?? undefined) : null;
  const paceZones = athlete.ltPace ? calculatePaceZones(athlete.ltPace) : null;

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <header className="sticky top-0 z-40 border-b border-[#1a1a1a] backdrop-blur-xl bg-black/60 px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <LogoFull size={30} />
          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-4 py-2 rounded-lg text-sm transition-all ${
                  item.href === "/dashboard/zones"
                    ? "text-white bg-white/10"
                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <Link href="/dashboard" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">
            ← Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Zonas de Treino</h1>
            <p className="text-zinc-500 text-sm mt-1">Zonas personalizadas com base no teu perfil fisiológico</p>
          </div>
          <Link
            href="/dashboard/profile"
            className="text-xs text-zinc-400 hover:text-zinc-200 border border-[#2a2a2a] px-3 py-1.5 rounded-lg transition-colors"
          >
            Atualizar perfil →
          </Link>
        </div>

        {!athlete.maxHR ? (
          <div className="card text-center py-12">
            <div className="text-4xl mb-4">❤️</div>
            <h2 className="text-lg font-bold text-white mb-2">FC Máxima não configurada</h2>
            <p className="text-zinc-500 text-sm mb-6">
              Define a tua frequência cardíaca máxima no perfil para calcular as zonas de treino.
            </p>
            <Link href="/dashboard/profile" className="inline-block px-4 py-2 bg-green-500 text-black font-medium rounded-xl text-sm hover:bg-green-400 transition-colors">
              Ir para o perfil
            </Link>
          </div>
        ) : (
          <>
            {/* HR Zones */}
            <div className="card">
              <div className="flex items-center justify-between mb-1">
                <h2 className="font-bold text-white">Zonas de FC</h2>
                <span className="text-xs text-zinc-500">FC Máx: {athlete.maxHR} bpm</span>
              </div>
              <p className="text-xs text-zinc-600 mb-4">
                {athlete.restingHR
                  ? `Método Karvonen (reserva de FC) · FC repouso: ${athlete.restingHR} bpm`
                  : "Baseado na FC Máxima (adiciona FC repouso para método Karvonen mais preciso)"}
              </p>
              <div className="space-y-3">
                {hrZones!.map((zone, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className={`w-2 h-10 rounded-full shrink-0 ${zone.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-white">{zone.name}</p>
                        <p className="text-sm font-mono text-zinc-300 shrink-0 ml-4">
                          {zone.low}–{zone.high} bpm
                        </p>
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5">{zone.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pace zones */}
            {paceZones ? (
              <div className="card">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="font-bold text-white">Zonas de Pace</h2>
                  <span className="text-xs text-zinc-500">Limiar: {athlete.ltPace}</span>
                </div>
                <p className="text-xs text-zinc-600 mb-4">Baseado no pace de limiar anaeróbico</p>
                <div className="space-y-3">
                  {paceZones.map((zone, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <div className={`w-2 h-10 rounded-full shrink-0 ${
                        i === 0 ? "bg-zinc-400" : i === 1 ? "bg-green-400" : i === 2 ? "bg-yellow-400" : i === 3 ? "bg-orange-400" : "bg-red-400"
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-white">{zone.name}</p>
                          <p className="text-sm font-mono text-zinc-300 shrink-0 ml-4">
                            {zone.low}{zone.high !== "—" ? `–${zone.high}` : "+"}
                          </p>
                        </div>
                        <p className="text-xs text-zinc-500 mt-0.5">{zone.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl border border-[#1f1f1f] bg-[#111]">
                <p className="text-sm text-zinc-400">
                  <span className="text-white font-medium">Pace de limiar não configurado.</span>{" "}
                  Adiciona o teu pace de limiar anaeróbico no{" "}
                  <Link href="/dashboard/profile" className="text-green-400 hover:text-green-300 underline">
                    perfil
                  </Link>{" "}
                  para calcular as zonas de pace.
                </p>
              </div>
            )}

            <p className="text-xs text-zinc-600 text-center">
              As tuas zonas são calculadas com o método Karvonen (reserva de FC) quando a FC de repouso está disponível.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
