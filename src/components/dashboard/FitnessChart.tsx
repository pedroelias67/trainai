"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type DayData = {
  date: string;
  ctl: number;
  atl: number;
  tsb: number;
};

type Props = {
  data: DayData[];
  todayCTL: number;
  todayATL: number;
  todayTSB: number;
};

function getTSBLabel(tsb: number): { label: string; color: string } {
  if (tsb > 10) return { label: "Fresco", color: "text-blue-400" };
  if (tsb >= 0) return { label: "Pronto", color: "text-green-400" };
  if (tsb >= -10) return { label: "Em carga", color: "text-orange-400" };
  return { label: "Fatigado", color: "text-red-400" };
}

export function FitnessChart({ data, todayCTL, todayATL, todayTSB }: Props) {
  const tsbStatus = getTSBLabel(todayTSB);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#111] border border-[#1f1f1f] rounded-2xl p-5 text-center">
          <p className="text-xs text-zinc-500 uppercase tracking-widest mb-2">Forma Crónica (CTL)</p>
          <p className="text-3xl font-bold text-blue-400">{todayCTL.toFixed(1)}</p>
          <p className="text-xs text-zinc-600 mt-1">Fitness base</p>
        </div>
        <div className="bg-[#111] border border-[#1f1f1f] rounded-2xl p-5 text-center">
          <p className="text-xs text-zinc-500 uppercase tracking-widest mb-2">Fadiga (ATL)</p>
          <p className="text-3xl font-bold text-orange-400">{todayATL.toFixed(1)}</p>
          <p className="text-xs text-zinc-600 mt-1">Carga recente</p>
        </div>
        <div className="bg-[#111] border border-[#1f1f1f] rounded-2xl p-5 text-center">
          <p className="text-xs text-zinc-500 uppercase tracking-widest mb-2">Forma Atual (TSB)</p>
          <p className={`text-3xl font-bold ${todayTSB >= 0 ? "text-green-400" : "text-red-400"}`}>
            {todayTSB > 0 ? "+" : ""}{todayTSB.toFixed(1)}
          </p>
          <p className={`text-xs mt-1 font-medium ${tsbStatus.color}`}>{tsbStatus.label}</p>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-[#111] border border-[#1f1f1f] rounded-2xl p-5">
        <h3 className="font-bold text-white mb-4">Evolução dos últimos 60 dias</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
            <XAxis
              dataKey="date"
              tick={{ fill: "#71717a", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              interval={9}
            />
            <YAxis
              tick={{ fill: "#71717a", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#111",
                border: "1px solid #2a2a2a",
                borderRadius: "12px",
                color: "#fff",
                fontSize: "12px",
              }}
              labelStyle={{ color: "#a1a1aa", marginBottom: "4px" }}
            />
            <Legend
              wrapperStyle={{ fontSize: "12px", color: "#a1a1aa", paddingTop: "16px" }}
            />
            <Line
              type="monotone"
              dataKey="ctl"
              name="Forma Crónica (CTL)"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="atl"
              name="Fadiga (ATL)"
              stroke="#f97316"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="tsb"
              name="Forma Atual (TSB)"
              stroke="#22c55e"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Legend explanation */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-center">
        {[
          { range: "TSB > 10", label: "Fresco", desc: "Bem descansado", color: "text-blue-400" },
          { range: "TSB 0–10", label: "Pronto", desc: "Pronto para competir", color: "text-green-400" },
          { range: "TSB -10–0", label: "Em carga", desc: "Treino pesado", color: "text-orange-400" },
          { range: "TSB < -10", label: "Fatigado", desc: "Descanso necessário", color: "text-red-400" },
        ].map((item) => (
          <div key={item.label} className="bg-[#111] border border-[#1f1f1f] rounded-xl p-3">
            <p className={`font-bold ${item.color}`}>{item.label}</p>
            <p className="text-zinc-500 mt-0.5">{item.range}</p>
            <p className="text-zinc-600 mt-0.5">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
