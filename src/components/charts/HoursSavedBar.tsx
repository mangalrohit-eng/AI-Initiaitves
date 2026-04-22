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

const grid = "rgba(26, 26, 46, 0.08)";
const axis = "rgba(26, 26, 46, 0.35)";
const tick = "#45405C";

export function HoursSavedBar({
  data,
}: {
  data: { name: string; hours: number }[];
}) {
  return (
    <div className="h-[320px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={grid} />
          <XAxis type="number" stroke={axis} tick={{ fill: tick, fontSize: 11 }} tickFormatter={(v) => formatHours(Number(v))} />
          <YAxis type="category" dataKey="name" width={140} tick={{ fill: tick, fontSize: 11 }} stroke={axis} />
          <Tooltip
            cursor={{ fill: "rgba(161,0,255,0.08)" }}
            contentStyle={{
              background: "#ffffff",
              border: "1px solid #d5c8e2",
              borderRadius: 12,
              color: "#1a1a2e",
              boxShadow: "0 8px 24px rgba(26,26,46,0.08)",
            }}
            formatter={(value) => [`${formatHours(Number(value))} hrs / yr`, "Hours saved"]}
          />
          <Bar dataKey="hours" fill="#A100FF" radius={[0, 8, 8, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
