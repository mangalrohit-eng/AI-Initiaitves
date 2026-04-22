"use client";

import type { Agent } from "@/data/types";
import { Badge } from "@/components/ui/Badge";
import { Cpu, Inbox, Send, Wrench } from "lucide-react";

export function AgentDetail({ agent }: { agent: Agent | null }) {
  if (!agent) {
    return (
      <div className="rounded-2xl border border-dashed border-forge-border-strong bg-forge-well/80 p-5 text-sm text-forge-subtle">
        Select an agent node to inspect inputs, outputs, and tools.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-forge-border bg-forge-surface p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-display text-lg font-semibold text-forge-ink">{agent.name}</div>
          <div className="mt-1 text-sm text-forge-body">{agent.role}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="Medium">{agent.type}</Badge>
          <Badge tone={agent.llmRequired ? "High" : "Low"}>{agent.llmRequired ? "LLM" : "Non-LLM"}</Badge>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-forge-border bg-forge-well p-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-forge-hint">
            <Inbox className="h-4 w-4 text-accent-teal" />
            Inputs
          </div>
          <ul className="mt-2 space-y-1 text-sm text-forge-body">
            {agent.inputs.map((i) => (
              <li key={i}>• {i}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-forge-border bg-forge-well p-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-forge-hint">
            <Send className="h-4 w-4 text-accent-purple" />
            Outputs
          </div>
          <ul className="mt-2 space-y-1 text-sm text-forge-body">
            {agent.outputs.map((o) => (
              <li key={o}>• {o}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-forge-border bg-forge-well p-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-forge-hint">
            <Wrench className="h-4 w-4 text-accent-amber" />
            Tools
          </div>
          <ul className="mt-2 space-y-1 text-sm text-forge-body">
            {agent.toolsUsed.map((t) => (
              <li key={t}>• {t}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs text-forge-hint">
        <Cpu className="h-4 w-4" />
        Click another node to compare orchestration roles across the process.
      </div>
    </div>
  );
}
