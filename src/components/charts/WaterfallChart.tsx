"use client";

import { impactTierScore } from "@/lib/utils";
import type { ImpactTier } from "@/data/types";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const grid = "rgba(26, 26, 46, 0.08)";
const axis = "rgba(26, 26, 46, 0.35)";
const tick = "#45405C";

export function WaterfallChart({ data }: { data: { name: string; impactTier: ImpactTier }[] }) {
  let cumBefore = 0;
  const rows = data.map((d) => {
    const delta = impactTierScore(d.impactTier);
    const row = { name: d.name, base: cumBefore, delta, tier: d.impactTier };
    cumBefore += delta;
    return row;
  });

  return (
    <div className="h-[360px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ left: 8, right: 16, top: 8, bottom: 48 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={grid} />
          <XAxis dataKey="name" tick={{ fill: tick, fontSize: 10 }} interval={0} angle={-18} textAnchor="end" height={70} stroke={axis} />
          <YAxis stroke={axis} tick={{ fill: tick, fontSize: 11 }} tickFormatter={(v) => String(Math.round(Number(v)))} />
          <Tooltip
            contentStyle={{
              background: "#ffffff",
              border: "1px solid #d5c8e2",
              borderRadius: 12,
              color: "#1a1a2e",
              boxShadow: "0 8px 24px rgba(26,26,46,0.08)",
            }}
            formatter={(value, name, item) => {
              if (name === "delta") {
                const tier = (item?.payload as { tier?: ImpactTier } | undefined)?.tier;
                return [tier ? `${tier} tier (1–3 scale)` : String(value), "Tower step"];
              }
              return [String(value), name === "base" ? "Carry-in (cumulative score)" : ""];
            }}
          />
          <Bar dataKey="base" stackId="wf" fill="rgba(255,255,255,0)" stroke="rgba(255,255,255,0)" />
          <Bar dataKey="delta" stackId="wf" fill="#A100FF" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
