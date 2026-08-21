// Every major brand syncs its recorded activities to Strava, and the app reads
// from Strava — so the analysis side already works with all of them. Stated in
// one place so the message stays consistent wherever Strava is offered.

const BRANDS = ["Garmin", "COROS", "Suunto", "Polar", "Wahoo", "Amazfit", "Huawei", "Apple Watch"];

export function WatchCompatibility({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <p className="text-xs text-[var(--text-faint)]">
        Funciona com {BRANDS.slice(0, 5).join(", ")} e outros — qualquer relógio que sincronize com o Strava.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] p-4">
      <p className="text-sm font-medium text-[var(--text-primary)] mb-1">Compatível com o teu relógio</p>
      <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-3">
        Treina com o que já tens. Os treinos que registares chegam aqui sozinhos e alimentam a análise
        semanal, seja qual for a marca — basta que o relógio sincronize com o Strava.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {BRANDS.map((brand) => (
          <span
            key={brand}
            className="text-xs px-2 py-0.5 rounded-full border border-[var(--border-hover)] bg-[var(--bg-hover)] text-[var(--text-secondary)]"
          >
            {brand}
          </span>
        ))}
      </div>
    </div>
  );
}
