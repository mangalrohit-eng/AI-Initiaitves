"use client";

import type { Agent, AgentFlow, AgentOrchestration } from "@/data/types";
import { motion } from "framer-motion";
import * as React from "react";

const typeColor: Record<Agent["type"], string> = {
  Orchestrator: "#A100FF",
  Specialist: "#00BFA5",
  Monitor: "#FFB300",
  Router: "#D966FF",
  Executor: "#00C853",
};

type Pattern = AgentOrchestration["pattern"];

function topoOrderedIds(agents: Agent[], flows: AgentFlow[]): string[] {
  const ids = agents.map((a) => a.id);
  const adj = new Map<string, string[]>(ids.map((id) => [id, []]));
  const indeg = new Map<string, number>(ids.map((id) => [id, 0]));
  for (const f of flows) {
    if (!adj.has(f.from) || !indeg.has(f.to)) continue;
    adj.get(f.from)!.push(f.to);
    indeg.set(f.to, (indeg.get(f.to) ?? 0) + 1);
  }
  const q = ids.filter((id) => (indeg.get(id) ?? 0) === 0);
  const out: string[] = [];
  const seen = new Set<string>();
  while (q.length) {
    const u = q.shift()!;
    if (seen.has(u)) continue;
    seen.add(u);
    out.push(u);
    for (const v of adj.get(u) ?? []) {
      indeg.set(v, (indeg.get(v) ?? 0) - 1);
      if ((indeg.get(v) ?? 0) === 0) q.push(v);
    }
  }
  for (const id of ids) if (!seen.has(id)) out.push(id);
  return out;
}

function hubAgentId(agents: Agent[], flows: AgentFlow[]): string {
  const deg = new Map<string, number>(agents.map((a) => [a.id, 0]));
  for (const f of flows) {
    if (deg.has(f.from)) deg.set(f.from, (deg.get(f.from) ?? 0) + 1);
    if (deg.has(f.to)) deg.set(f.to, (deg.get(f.to) ?? 0) + 1);
  }
  const prefer = agents.find((a) => a.type === "Orchestrator" || a.type === "Router");
  if (prefer) return prefer.id;
  let best = agents[0]!.id;
  for (const a of agents) if ((deg.get(a.id) ?? 0) > (deg.get(best) ?? 0)) best = a.id;
  return best;
}

function hierarchicalLayers(agents: Agent[], flows: AgentFlow[]) {
  const ids = new Set(agents.map((a) => a.id));
  const adj = new Map<string, string[]>();
  agents.forEach((a) => adj.set(a.id, []));
  for (const f of flows) {
    if (ids.has(f.from) && ids.has(f.to)) adj.get(f.from)!.push(f.to);
  }
  const indeg = new Map<string, number>();
  agents.forEach((a) => indeg.set(a.id, 0));
  for (const f of flows) {
    if (indeg.has(f.to)) indeg.set(f.to, (indeg.get(f.to) ?? 0) + 1);
  }
  const rem = new Map(indeg);
  const layer = new Map<string, number>();
  const queue = agents.filter((a) => (rem.get(a.id) ?? 0) === 0).map((a) => a.id);
  queue.forEach((r) => layer.set(r, 0));
  const q = [...queue];
  while (q.length) {
    const u = q.shift()!;
    const L = layer.get(u) ?? 0;
    for (const v of adj.get(u) ?? []) {
      layer.set(v, Math.max(layer.get(v) ?? 0, L + 1));
      rem.set(v, (rem.get(v) ?? 0) - 1);
      if ((rem.get(v) ?? 0) === 0) q.push(v);
    }
  }
  agents.forEach((a) => {
    if (!layer.has(a.id)) layer.set(a.id, 0);
  });
  return layer;
}

function layoutByPattern(pattern: Pattern, agents: Agent[], flows: AgentFlow[]) {
  const cellW = 220;
  const cellH = 130;
  const pad = 48;
  const positions: Record<string, { x: number; y: number }> = {};

  if (pattern === "Pipeline") {
    const ordered = topoOrderedIds(agents, flows);
    ordered.forEach((id, i) => {
      positions[id] = { x: pad + i * cellW, y: pad + cellH };
    });
    const n = Math.max(ordered.length, 1);
    return { positions, width: pad * 2 + (n - 1) * cellW + 200, height: pad * 2 + cellH * 2 + 80 };
  }

  if (pattern === "Sequential") {
    const ordered = topoOrderedIds(agents, flows);
    ordered.forEach((id, i) => {
      positions[id] = { x: pad + cellW * 1.2, y: pad + i * cellH };
    });
    const n = Math.max(ordered.length, 1);
    return { positions, width: pad * 2 + cellW * 2.8, height: pad * 2 + (n - 1) * cellH + 120 };
  }

  if (pattern === "Parallel") {
    agents.forEach((a, i) => {
      positions[a.id] = { x: pad + i * cellW, y: pad + cellH };
    });
    const n = Math.max(agents.length, 1);
    return { positions, width: pad * 2 + Math.max(1, n - 1) * cellW + 200, height: pad * 2 + cellH * 2 + 80 };
  }

  if (pattern === "Hub-and-Spoke") {
    const h = hubAgentId(agents, flows);
    const cx = pad + cellW * 2;
    const cy = pad + cellH * 1.4;
    positions[h] = { x: cx, y: cy };
    const spokes = agents.filter((a) => a.id !== h);
    const R = Math.max(150, 120 + spokes.length * 14);
    spokes.forEach((a, i) => {
      const theta = -Math.PI / 2 + (i / Math.max(1, spokes.length)) * 2 * Math.PI;
      positions[a.id] = { x: cx + R * Math.cos(theta), y: cy + R * Math.sin(theta) };
    });
    return { positions, width: cx + R + pad + 120, height: cy + R + pad + 100 };
  }

  /* Hierarchical */
  const layers = hierarchicalLayers(agents, flows);
  const maxL = Math.max(0, ...agents.map((a) => layers.get(a.id) ?? 0));
  const byLayer = new Map<number, string[]>();
  for (let L = 0; L <= maxL; L++) byLayer.set(L, []);
  for (const a of agents) byLayer.get(layers.get(a.id) ?? 0)!.push(a.id);
  for (let L = 0; L <= maxL; L++) {
    const row = byLayer.get(L)!;
    const rowW = Math.max(0, (row.length - 1) * cellW);
    row.forEach((id, i) => {
      positions[id] = { x: pad + cellW * 2 - rowW / 2 + i * cellW, y: pad + L * cellH * 1.05 };
    });
  }
  const width = pad * 2 + cellW * 5;
  const height = pad * 2 + (maxL + 1) * cellH * 1.05 + 60;
  return { positions, width, height };
}

function edgePath(a: { x: number; y: number }, b: { x: number; y: number }) {
  const mx = (a.x + b.x) / 2;
  return `M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`;
}

export function AgentDiagram({
  agents,
  flows,
  pattern,
  patternLabel,
  patternDescription,
  selected,
  onSelect,
}: {
  agents: Agent[];
  flows: AgentFlow[];
  pattern: Pattern;
  patternLabel: string;
  patternDescription: string;
  selected: Agent | null;
  onSelect: (a: Agent) => void;
}) {
  const { positions, width, height } = React.useMemo(
    () => layoutByPattern(pattern, agents, flows),
    [pattern, agents, flows],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-forge-hint">Orchestration pattern</div>
          <div className="mt-1 font-mono text-sm text-forge-ink">{patternLabel}</div>
          <p className="mt-2 max-w-3xl text-sm text-forge-body">{patternDescription}</p>
        </div>
        <div className="rounded-full border border-forge-border bg-forge-well px-3 py-1 text-xs text-forge-subtle">
          {agents.length} agents · {flows.length} flows
        </div>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-forge-border bg-forge-page shadow-inner">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-[420px] w-full sm:h-[460px]">
          <defs>
            <linearGradient id="flow" x1="0" x2="1" y1="0" y2="0">
              <stop stopColor="#A100FF" stopOpacity="0.15" />
              <stop offset="0.5" stopColor="#A100FF" stopOpacity="0.75" />
              <stop offset="1" stopColor="#00BFA5" stopOpacity="0.55" />
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
                animate={{ pathLength: 1, opacity: 0.95 }}
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
                  fill={active ? "rgba(161,0,255,0.12)" : "#ffffff"}
                  stroke={active ? "#A100FF" : "rgba(213,207,226,0.95)"}
                  strokeWidth={active ? 2 : 1}
                  className="cursor-pointer"
                  onClick={() => onSelect(ag)}
                />
                <text x={16} y={26} fill="#6B6685" fontSize="11" fontFamily="var(--font-jetbrains), monospace">
                  {ag.type}
                </text>
                <text x={16} y={46} fill="#1A1A2E" fontSize="13" fontFamily="var(--font-dm-sans), sans-serif" fontWeight="600">
                  {ag.name.length > 26 ? `${ag.name.slice(0, 24)}…` : ag.name}
                </text>
                <circle cx={168} cy={22} r={6} fill={color} opacity={0.95} />
                {ag.llmRequired ? (
                  <text x={154} y={48} fill="#6B6685" fontSize="10" fontFamily="var(--font-jetbrains), monospace">
                    LLM
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-forge-well to-transparent" />
      </div>

      <div className="flex flex-wrap gap-2 text-[11px] text-forge-subtle">
        {Object.entries(typeColor).map(([k, v]) => (
          <span
            key={k}
            className="inline-flex items-center gap-2 rounded-full border border-forge-border bg-forge-surface px-2 py-1 text-forge-body shadow-sm"
          >
            <span className="h-2 w-2 rounded-full" style={{ background: v }} />
            {k}
          </span>
        ))}
      </div>
    </div>
  );
}
