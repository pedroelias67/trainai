import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import EnrichedMap from "@/components/dashboard/EnrichedMap";
import { LogoFull } from "@/components/ui/Logo";
import { formatClock, formatPacePerKm, paceToSeconds } from "@/lib/format";
import { trimTrackEnds, type TrackPoint } from "@/lib/share-privacy";

// Unlisted, not secret: anyone with the link can read it, and nobody should find
// it without one.
export const metadata: Metadata = { robots: { index: false, follow: false } };

const SPORT_LABELS: Record<string, string> = {
  RUNNING: "Corrida", CYCLING: "Ciclismo", SWIMMING: "Natação",
  TRIATHLON_SPRINT: "Triatlo", TRIATHLON_OLYMPIC: "Triatlo",
  TRIATHLON_HALF: "Triatlo", TRIATHLON_FULL: "Triatlo",
};

type Split = { km: number; pace: string | null };

export default async function SharedActivityPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // Only the fields worth publishing: no notes, no heart rate, no raw payload.
  const activity = await prisma.activity.findUnique({
    where: { shareToken: token },
    select: {
      name: true, sport: true, date: true, distance: true, duration: true,
      avgPace: true, elevationGain: true, splits: true, gpsTrack: true,
      athlete: { select: { shareTrimMap: true, user: { select: { name: true } } } },
    },
  });
  if (!activity) notFound();

  const track = (Array.isArray(activity.gpsTrack) ? activity.gpsTrack : []) as unknown as TrackPoint[];
  const trimmed = activity.athlete.shareTrimMap ? trimTrackEnds(track) : track;
  // Heart rate is not published, so it must not travel to the browser either.
  const publicTrack = trimmed.map(({ lat, lng, ele, pace }) => ({ lat, lng, ele, pace }));
  const hidden = activity.athlete.shareTrimMap && trimmed.length < track.length;

  const splits = (Array.isArray(activity.splits) ? activity.splits : []) as unknown as Split[];
  const km = activity.distance ? activity.distance / 1000 : null;
  const stats = [
    { label: "Distância", value: km ? `${km.toFixed(2)} km` : "—" },
    { label: "Tempo", value: activity.duration ? formatClock(activity.duration) : "—" },
    { label: "Ritmo", value: activity.avgPace ?? "—" },
    { label: "Subida", value: activity.elevationGain ? `${Math.round(activity.elevationGain)} m` : "—" },
  ];

  const fastest = splits.reduce<number | null>((best, s) => {
    const secs = paceToSeconds(s.pace);
    return secs && (best === null || secs < best) ? secs : best;
  }, null);

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <header className="border-b border-[var(--border)] px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <LogoFull size={28} />
          <Link href="/" className="text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
            O que é isto?
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <p className="text-green-400 text-xs font-medium uppercase tracking-widest mb-2">
          {SPORT_LABELS[activity.sport] ?? activity.sport}
        </p>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">{activity.name ?? "Treino"}</h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">
          {activity.athlete.user.name ? `${activity.athlete.user.name} · ` : ""}
          {activity.date.toLocaleDateString("pt-PT", { day: "numeric", month: "long", year: "numeric" })}
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          {stats.map(s => (
            <div key={s.label} className="stat-card">
              <p className="text-[var(--text-muted)] text-xs">{s.label}</p>
              <p className="text-[var(--text-primary)] text-lg font-bold">{s.value}</p>
            </div>
          ))}
        </div>

        {publicTrack.length > 3 && (
          <div className="mt-6 rounded-2xl overflow-hidden border border-[var(--border)]">
            <EnrichedMap gpsTrack={publicTrack} elevationGain={activity.elevationGain} height={320} compact showHeartRate={false} />
          </div>
        )}

        {hidden && (
          <p className="text-[var(--text-faint)] text-xs mt-3">
            O início e o fim do percurso estão ocultos por privacidade.
          </p>
        )}
        {activity.athlete.shareTrimMap && track.length > 3 && publicTrack.length === 0 && (
          <p className="text-[var(--text-faint)] text-xs mt-3">
            O percurso não é mostrado: era demasiado perto do ponto de partida para o esconder.
          </p>
        )}

        {splits.length > 0 && (
          <div className="card mt-6">
            <h2 className="text-[var(--text-primary)] font-semibold text-sm mb-4">Parciais por quilómetro</h2>
            <div className="space-y-1.5">
              {splits.map(s => {
                const secs = paceToSeconds(s.pace);
                // A bar per kilometre, longest for the slowest, so the shape of
                // the effort reads at a glance.
                const width = secs && fastest ? Math.max(20, (fastest / secs) * 100) : 0;
                return (
                  <div key={s.km} className="flex items-center gap-3">
                    <span className="text-[var(--text-muted)] text-xs w-8 shrink-0">{s.km}</span>
                    <div className="flex-1 h-5 rounded bg-[var(--bg-hover)] overflow-hidden">
                      <div className="h-full bg-green-500/40 rounded" style={{ width: `${width}%` }} />
                    </div>
                    <span className="text-[var(--text-secondary)] text-xs w-20 text-right shrink-0">
                      {secs ? formatPacePerKm(secs) : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-10 text-center border-t border-[var(--border)] pt-8">
          <p className="text-[var(--text-muted)] text-sm mb-4">
            Treino partilhado a partir do TrainAI — planos de treino gerados e ajustados por IA.
          </p>
          <Link href="/" className="btn-secondary inline-block text-sm">Conhecer o TrainAI</Link>
        </div>
      </main>
    </div>
  );
}
