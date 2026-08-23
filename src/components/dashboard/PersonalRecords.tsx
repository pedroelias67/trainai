"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { subDays } from "date-fns";

interface PR {
  id: string;
  distance: number;
  timeSeconds: number;
  pace: string | null;
  date: string;
  activityId: string | null;
}

interface Props {
  records: PR[];
  /** Whether there is any run history to derive records from. */
  hasActivities?: boolean;
}

const DISTANCES = [
  { meters: 5000, label: "5 km" },
  { meters: 10000, label: "10 km" },
  { meters: 21097, label: "Meia Maratona" },
  { meters: 42195, label: "Maratona" },
];

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function PersonalRecords({ records, hasActivities = false }: Props) {
  const thirtyDaysAgo = subDays(new Date(), 30);
  const router = useRouter();
  const [calculating, setCalculating] = useState(false);

  // Records are derived on sync. An athlete whose activities were imported
  // before that existed needs a way to backfill them once.
  const needsBackfill = records.length === 0 && hasActivities;

  async function calculate() {
    setCalculating(true);
    try {
      await fetch("/api/personal-records", { method: "POST" });
      router.refresh();
    } finally {
      setCalculating(false);
    }
  }

  return (
    <div className="card mb-6">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h2 className="font-bold text-white">Records Pessoais</h2>
        {needsBackfill && (
          <button onClick={calculate} disabled={calculating}
            className="btn-primary text-xs py-1.5 px-3 shrink-0 disabled:opacity-50">
            {calculating ? "A calcular…" : "Calcular a partir do histórico"}
          </button>
        )}
      </div>
      <p className="text-xs text-[var(--text-muted)] mb-4">
        Tempos que correste de facto. Para distâncias que ainda não fizeste, vê a previsão de prova no Dashboard.
      </p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {DISTANCES.map(({ meters, label }) => {
          const pr = records.find((r) => r.distance === meters);
          const isRecent = pr && new Date(pr.date) >= thirtyDaysAgo;

          return (
            <div key={meters} className="bg-[var(--bg-subtle)] rounded-xl p-4 text-center">
              <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2">{label}</p>
              {pr ? (
                <>
                  <p className={`text-xl font-bold ${isRecent ? "text-green-400" : "text-white"}`}>
                    {formatTime(pr.timeSeconds)}
                    {isRecent && <span className="ml-1 text-sm">↗</span>}
                  </p>
                  {pr.pace && <p className="text-xs text-[var(--text-muted)] mt-1">{pr.pace}</p>}
                  <p className="text-xs text-[var(--text-faint)] mt-1">
                    {new Date(pr.date).toLocaleDateString("pt-PT", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                  {pr.activityId && (
                    <Link href={`/dashboard/activity/${pr.activityId}`} className="text-xs text-green-400 hover:text-green-300 mt-1 inline-block">
                      Ver atividade →
                    </Link>
                  )}
                </>
              ) : (
                <>
                  <p className="text-2xl text-zinc-700 font-bold mt-2">—</p>
                  <p className="text-[10px] text-[var(--text-faint)] mt-1">ainda não corrida</p>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
