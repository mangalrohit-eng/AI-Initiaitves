"use client";

import { formatHours } from "@/lib/utils";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function WaterfallChart({ data }: { data: { name: string; hours: number }[] }) {
  let cumBefore = 0;
  const rows = data.map((d) => {
    const row = { name: d.name, base: cumBefore, delta: d.hours };
    cumBefore += d.hours;
    return row;
  });

  return (
    <div className="h-[360px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ left: 8, right: 16, top: 8, bottom: 48 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
          <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 10 }} interval={0} angle={-18} textAnchor="end" height={70} />
          <YAxis stroke="rgba(255,255,255,0.15)" tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }} tickFormatter={(v) => formatHours(Number(v))} />
          <Tooltip
            contentStyle={{
              background: "#121225",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 12,
              color: "#fff",
            }}
            formatter={(value: number, name) => [
              `${formatHours(value)} hrs`,
              name === "base" ? "Carry-in (cumulative)" : "Tower contribution",
            ]}
          />
          <Bar dataKey="base" stackId="wf" fill="rgba(255,255,255,0)" stroke="rgba(255,255,255,0)" />
          <Bar dataKey="delta" stackId="wf" fill="#A100FF" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
