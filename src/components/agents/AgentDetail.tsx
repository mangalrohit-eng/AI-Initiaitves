"use client";

import type { Agent } from "@/data/types";
import { Badge } from "@/components/ui/Badge";
import { Cpu, Inbox, Send, Wrench } from "lucide-react";

export function AgentDetail({ agent }: { agent: Agent | null }) {
  if (!agent) {
    return (
      <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-5 text-sm text-white/55">
        Select an agent node to inspect inputs, outputs, and tools.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0f1020]/80 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-display text-lg font-semibold text-white">{agent.name}</div>
          <div className="mt-1 text-sm text-white/65">{agent.role}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="Medium">{agent.type}</Badge>
          <Badge tone={agent.llmRequired ? "High" : "Low"}>{agent.llmRequired ? "LLM" : "Non-LLM"}</Badge>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/45">
            <Inbox className="h-4 w-4 text-accent-teal" />
            Inputs
          </div>
          <ul className="mt-2 space-y-1 text-sm text-white/70">
            {agent.inputs.map((i) => (
              <li key={i}>• {i}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/45">
            <Send className="h-4 w-4 text-accent-purple-light" />
            Outputs
          </div>
          <ul className="mt-2 space-y-1 text-sm text-white/70">
            {agent.outputs.map((o) => (
              <li key={o}>• {o}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/45">
            <Wrench className="h-4 w-4 text-accent-amber" />
            Tools
          </div>
          <ul className="mt-2 space-y-1 text-sm text-white/70">
            {agent.toolsUsed.map((t) => (
              <li key={t}>• {t}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs text-white/45">
        <Cpu className="h-4 w-4" />
        Click another node to compare orchestration roles across the process.
      </div>
    </div>
  );
}
