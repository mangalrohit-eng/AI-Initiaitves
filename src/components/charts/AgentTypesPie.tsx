"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const palette = ["#A100FF", "#00BFA5", "#FFB300", "#D966FF", "#00C853"];

export function AgentTypesPie({ data }: { data: { type: string; count: number }[] }) {
  return (
    <div className="h-[320px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="count" nameKey="type" innerRadius={70} outerRadius={110} paddingAngle={2}>
            {data.map((_, i) => (
              <Cell key={i} fill={palette[i % palette.length]} stroke="rgba(26,26,46,0.08)" />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "#ffffff",
              border: "1px solid #d5c8e2",
              borderRadius: 12,
              color: "#1a1a2e",
              boxShadow: "0 8px 24px rgba(26,26,46,0.08)",
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
