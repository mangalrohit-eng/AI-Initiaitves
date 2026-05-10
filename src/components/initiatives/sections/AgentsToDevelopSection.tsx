import * as React from "react";
import { Bot, Cpu } from "lucide-react";
import type { SolutionBrief } from "@/data/types";
import { cn } from "@/lib/utils";
import { SectionShell } from "./sectionShell";

/**
 * Section F — Agents Versant needs to develop when sourcing leans Build.
 *
 * Curated subset of `Process.agents[]` written in client-friendly
 * language (each agent gets a name + role narrative). Hidden by the
 * caller when the array is empty (e.g. pure Buy verdicts).
 */
export function AgentsToDevelopSection({ brief }: { brief: SolutionBrief }) {
  const agents = brief.buildAgents;
  if (agents.length === 0) return null;
  return (
    <SectionShell
      letter="F"
      title="AI agents Versant will build"
      subtitle="Custom agents required for the Build path"
    >
      <ul className="grid gap-3 sm:grid-cols-2">
        {agents.map((a, i) => (
          <li
            key={i}
            className="rounded-xl border border-forge-border/60 bg-near-black/30 p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-purple/10 text-accent-purple-light">
                  <Bot className="h-4 w-4" aria-hidden />
                </span>
                <h3 className="truncate font-display text-sm font-semibold text-forge-ink">
                  {a.name}
                </h3>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em]",
                  a.llmRequired === false
                    ? "border-forge-border bg-near-black/40 text-forge-subtle"
                    : "border-accent-purple/40 bg-accent-purple/10 text-accent-purple-light",
                )}
                title={
                  a.llmRequired === false
                    ? "Deterministic / rules-based agent — no LLM required."
                    : "LLM-backed agent."
                }
              >
                <Cpu className="mr-1 inline h-2.5 w-2.5" aria-hidden />
                {a.llmRequired === false ? "Rules" : "LLM"}
              </span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-forge-body">
              {a.role}
            </p>
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}
