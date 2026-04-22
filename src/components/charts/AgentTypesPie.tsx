"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const palette = ["#A100FF", "#00BFA5", "#FFB300", "#D966FF", "#00C853"];

export function AgentTypesPie({ data }: { data: { type: string; count: number }[] }) {
  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="count" nameKey="type" innerRadius={70} outerRadius={110} paddingAngle={2}>
            {data.map((_, i) => (
              <Cell key={i} fill={palette[i % palette.length]} stroke="rgba(0,0,0,0.35)" />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "#121225",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 12,
              color: "#fff",
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
