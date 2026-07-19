"use client";

import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";

interface WeekPoint {
  week: string;
  avgPaceSec: number | null;
  avgHR: number | null;
  km: number;
  paceLabel: string | null;
}

interface Props {
  data: WeekPoint[];
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-3 text-xs space-y-1">
      <p className="text-[var(--text-muted)] mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <strong>{p.name === "Pace médio" ? p.payload.paceLabel : p.value}</strong>
          {p.name === "FC média" ? " bpm" : p.name === "Volume" ? " km" : ""}
        </p>
      ))}
    </div>
  );
}

export function ProgressionChart({ data }: Props) {
  const hasData = data.some((d) => d.avgPaceSec || d.avgHR);

  if (!hasData) {
    return (
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-8 text-center">
        <p className="text-[var(--text-muted)] text-sm">Sem dados suficientes para mostrar a progressão.</p>
        <p className="text-[var(--text-faint)] text-xs mt-1">Sincroniza treinos via Strava para ver a evolução.</p>
      </div>
    );
  }

  // Invert pace for chart (lower is better → show as higher bar)
  const maxPace = Math.max(...data.filter((d) => d.avgPaceSec).map((d) => d.avgPaceSec!));

  const chartData = data.map((d) => ({
    ...d,
    paceInverted: d.avgPaceSec ? maxPace - d.avgPaceSec + 200 : null,
  }));

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 space-y-4">
      <div>
        <h3 className="font-bold text-[var(--text-primary)]">Progressão de Pace e FC</h3>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">
          Pace médio e FC média por semana — melhoria = pace a descer com FC estável ou a descer
        </p>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="week" tick={{ fill: "var(--text-muted)", fontSize: 10 }} tickLine={false} axisLine={false} interval={1} />
          <YAxis yAxisId="hr" orientation="right" tick={{ fill: "var(--text-muted)", fontSize: 10 }} tickLine={false} axisLine={false} domain={["auto", "auto"]} label={{ value: "bpm", angle: 90, position: "insideRight", fill: "var(--text-faint)", fontSize: 10 }} />
          <YAxis yAxisId="pace" orientation="left" hide />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: "11px", color: "var(--text-muted)", paddingTop: "12px" }} />
          <Bar yAxisId="pace" dataKey="km" name="Volume" fill="var(--bg-hover)" radius={[4, 4, 0, 0]} opacity={0.6} />
          <Line yAxisId="pace" type="monotone" dataKey="paceInverted" name="Pace médio" stroke="#22c55e" strokeWidth={2} dot={{ r: 3, fill: "#22c55e" }} connectNulls />
          <Line yAxisId="hr" type="monotone" dataKey="avgHR" name="FC média" stroke="#f97316" strokeWidth={2} dot={{ r: 3, fill: "#f97316" }} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>

      <p className="text-xs text-[var(--text-faint)] text-center">
        A linha verde sobe quando o pace melhora (fica mais rápido). Se a FC laranja descer ao mesmo tempo → ganho real de eficiência aeróbica.
      </p>
    </div>
  );
}
