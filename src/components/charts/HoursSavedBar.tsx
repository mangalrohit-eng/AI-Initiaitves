"use client";

import { formatHours } from "@/lib/utils";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function HoursSavedBar({
  data,
}: {
  data: { name: string; hours: number }[];
}) {
  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
          <XAxis type="number" stroke="rgba(255,255,255,0.35)" tickFormatter={(v) => formatHours(Number(v))} />
          <YAxis
            type="category"
            dataKey="name"
            width={140}
            tick={{ fill: "rgba(255,255,255,0.65)", fontSize: 11 }}
            stroke="rgba(255,255,255,0.15)"
          />
          <Tooltip
            cursor={{ fill: "rgba(161,0,255,0.08)" }}
            contentStyle={{
              background: "#121225",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 12,
              color: "#fff",
            }}
            formatter={(value: number) => [`${formatHours(value)} hrs / yr`, "Hours saved"]}
          />
          <Bar dataKey="hours" fill="#A100FF" radius={[0, 8, 8, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
