"use client";

import Link from "next/link";
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

export function PersonalRecords({ records }: Props) {
  const thirtyDaysAgo = subDays(new Date(), 30);

  return (
    <div className="card mb-6">
      <h2 className="font-bold text-white mb-4">Records Pessoais</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {DISTANCES.map(({ meters, label }) => {
          const pr = records.find((r) => r.distance === meters);
          const isRecent = pr && new Date(pr.date) >= thirtyDaysAgo;

          return (
            <div key={meters} className="bg-[#161616] rounded-xl p-4 text-center">
              <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">{label}</p>
              {pr ? (
                <>
                  <p className={`text-xl font-bold ${isRecent ? "text-green-400" : "text-white"}`}>
                    {formatTime(pr.timeSeconds)}
                    {isRecent && <span className="ml-1 text-sm">↗</span>}
                  </p>
                  {pr.pace && <p className="text-xs text-zinc-500 mt-1">{pr.pace}</p>}
                  <p className="text-xs text-zinc-600 mt-1">
                    {new Date(pr.date).toLocaleDateString("pt-PT", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                  {pr.activityId && (
                    <Link href={`/dashboard/activity/${pr.activityId}`} className="text-xs text-green-400 hover:text-green-300 mt-1 inline-block">
                      Ver atividade →
                    </Link>
                  )}
                </>
              ) : (
                <p className="text-2xl text-zinc-700 font-bold mt-2">—</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
