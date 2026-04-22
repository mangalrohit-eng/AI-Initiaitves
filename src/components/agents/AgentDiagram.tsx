"use client";

import type { Agent, AgentFlow } from "@/data/types";
import { motion } from "framer-motion";
import * as React from "react";

const typeColor: Record<Agent["type"], string> = {
  Orchestrator: "#A100FF",
  Specialist: "#00BFA5",
  Monitor: "#FFB300",
  Router: "#D966FF",
  Executor: "#00C853",
};

function layout(agents: Agent[]) {
  const cols = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(agents.length))));
  const cellW = 220;
  const cellH = 120;
  const pad = 40;
  const positions: Record<string, { x: number; y: number }> = {};
  agents.forEach((a, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions[a.id] = { x: pad + col * cellW, y: pad + row * cellH };
  });
  const width = pad * 2 + cols * cellW;
  const height = pad * 2 + (Math.ceil(agents.length / cols) || 1) * cellH;
  return { positions, width, height, cellW, cellH, cols, pad };
}

function edgePath(a: { x: number; y: number }, b: { x: number; y: number }) {
  const mx = (a.x + b.x) / 2;
  return `M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`;
}

export function AgentDiagram({
  agents,
  flows,
  patternLabel,
  patternDescription,
  selected,
  onSelect,
}: {
  agents: Agent[];
  flows: AgentFlow[];
  patternLabel: string;
  patternDescription: string;
  selected: Agent | null;
  onSelect: (a: Agent) => void;
}) {
  const { positions, width, height } = React.useMemo(() => layout(agents), [agents]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-white/45">Orchestration pattern</div>
          <div className="mt-1 font-mono text-sm text-white">{patternLabel}</div>
          <p className="mt-2 max-w-3xl text-sm text-white/65">{patternDescription}</p>
        </div>
        <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-white/60">
          {agents.length} agents · {flows.length} flows
        </div>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0b0c18]">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-[420px] w-full sm:h-[460px]">
          <defs>
            <linearGradient id="flow" x1="0" x2="1" y1="0" y2="0">
              <stop stopColor="#A100FF" stopOpacity="0.0" />
              <stop offset="0.5" stopColor="#A100FF" stopOpacity="0.65" />
              <stop offset="1" stopColor="#00BFA5" stopOpacity="0.35" />
            </linearGradient>
          </defs>

          {flows.map((f, idx) => {
            const a = positions[f.from];
            const b = positions[f.to];
            if (!a || !b) return null;
            const d = edgePath(a, b);
            return (
              <motion.path
                key={`${f.from}-${f.to}-${idx}`}
                d={d}
                fill="none"
                stroke="url(#flow)"
                strokeWidth={2}
                strokeDasharray="6 6"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 0.9 }}
                transition={{ delay: 0.08 * idx, duration: 0.65, ease: "easeInOut" }}
              />
            );
          })}

          {agents.map((ag, idx) => {
            const p = positions[ag.id];
            if (!p) return null;
            const active = selected?.id === ag.id;
            const color = typeColor[ag.type];
            return (
              <g key={ag.id} transform={`translate(${p.x - 92}, ${p.y - 34})`}>
                <motion.rect
                  width={184}
                  height={68}
                  rx={14}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.04 * idx, duration: 0.25 }}
                  fill={active ? "rgba(161,0,255,0.18)" : "rgba(255,255,255,0.04)"}
                  stroke={active ? "#D966FF" : "rgba(255,255,255,0.14)"}
                  strokeWidth={active ? 2 : 1}
                  className="cursor-pointer"
                  onClick={() => onSelect(ag)}
                />
                <text x={16} y={26} fill="rgba(255,255,255,0.55)" fontSize="11" fontFamily="var(--font-jetbrains), monospace">
                  {ag.type}
                </text>
                <text x={16} y={46} fill="#ffffff" fontSize="13" fontFamily="var(--font-dm-sans), sans-serif" fontWeight="600">
                  {ag.name.length > 26 ? `${ag.name.slice(0, 24)}…` : ag.name}
                </text>
                <circle cx={168} cy={22} r={6} fill={color} opacity={0.95} />
                {ag.llmRequired ? (
                  <text x={154} y={48} fill="rgba(255,255,255,0.55)" fontSize="10" fontFamily="var(--font-jetbrains), monospace">
                    LLM
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#0b0c18] to-transparent" />
      </div>

      <div className="flex flex-wrap gap-2 text-[11px] text-white/55">
        {Object.entries(typeColor).map(([k, v]) => (
          <span key={k} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-2 py-1">
            <span className="h-2 w-2 rounded-full" style={{ background: v }} />
            {k}
          </span>
        ))}
      </div>
    </div>
  );
}
