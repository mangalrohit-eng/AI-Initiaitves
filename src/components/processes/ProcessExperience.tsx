"use client";

import type { Process } from "@/data/types";
import { TabGroup } from "@/components/ui/TabGroup";
import { WorkTab } from "@/components/lenses/WorkTab";
import { WorkforceTab } from "@/components/lenses/WorkforceTab";
import { WorkbenchTab } from "@/components/lenses/WorkbenchTab";
import { DigitalCoreTab } from "@/components/lenses/DigitalCoreTab";
import { AgentDiagram } from "@/components/agents/AgentDiagram";
import { AgentDetail } from "@/components/agents/AgentDetail";
import { ChevronRight } from "lucide-react";
import * as React from "react";

const LENSES: {
  id: string;
  label: string;
  sub: string;
  render: (p: Process) => React.ReactNode;
}[] = [
  { id: "work", label: "The work", sub: "Steps, handoffs, cycle time", render: (p) => <WorkTab process={p} /> },
  { id: "workforce", label: "The team", sub: "Roles, time, skills", render: (p) => <WorkforceTab process={p} /> },
  { id: "workbench", label: "Tools & apps", sub: "What people and agents use", render: (p) => <WorkbenchTab process={p} /> },
  { id: "digital", label: "Platform", sub: "Data, integrations, build effort", render: (p) => <DigitalCoreTab process={p} /> },
];

export function ProcessExperience({ process }: { process: Process }) {
  const [selected, setSelected] = React.useState<Process["agents"][number] | null>(
    process.agents[0] ?? null,
  );

  React.useEffect(() => {
    setSelected(process.agents[0] ?? null);
  }, [process]);

  // When printing, force-open every collapsible <details> so the PDF is complete.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const prevStates = new WeakMap<HTMLDetailsElement, boolean>();
    const before = () => {
      document.querySelectorAll("details").forEach((d) => {
        prevStates.set(d as HTMLDetailsElement, d.open);
        (d as HTMLDetailsElement).open = true;
      });
    };
    const after = () => {
      document.querySelectorAll("details").forEach((d) => {
        const prev = prevStates.get(d as HTMLDetailsElement);
        if (typeof prev === "boolean") (d as HTMLDetailsElement).open = prev;
      });
    };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, []);

  return (
    <div className="space-y-10">
      <section aria-labelledby="lens-heading" className="space-y-4">
        <div>
          <h2 id="lens-heading" className="font-display text-xl font-semibold text-forge-ink">
            What changes — across four lenses
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-forge-subtle">
            The same initiative, viewed from four angles. Today vs. with agentic AI.
          </p>
        </div>

        <div className="no-print">
          <TabGroup
            tabs={LENSES.map((l) => ({ id: l.id, label: l.label, content: l.render(process) }))}
          />
        </div>

        <div className="print-only space-y-8">
          {LENSES.map((l) => (
            <div key={l.id} className="rounded-2xl border border-forge-border bg-forge-surface p-4 shadow-card sm:p-6">
              <div className="mb-4 border-b border-forge-border pb-3">
                <div className="font-display text-lg font-semibold text-forge-ink">{l.label}</div>
                <div className="text-xs text-forge-subtle">{l.sub}</div>
              </div>
              {l.render(process)}
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="arch-heading" className="space-y-3">
        <details className="group rounded-2xl border border-forge-border bg-forge-surface shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl p-5 transition hover:bg-forge-well/60">
            <div>
              <div id="arch-heading" className="font-display text-lg font-semibold text-forge-ink">
                Technical architecture
              </div>
              <div className="mt-1 text-xs text-forge-subtle">
                For platform and architecture teams — {process.agents.length} agents,{" "}
                {process.agentOrchestration.flow.length} flows, pattern:{" "}
                {process.agentOrchestration.pattern}.
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-forge-subtle transition group-open:rotate-90" />
          </summary>
          <div className="space-y-4 border-t border-forge-border p-5">
            <AgentDiagram
              agents={process.agents}
              flows={process.agentOrchestration.flow}
              pattern={process.agentOrchestration.pattern}
              patternLabel={process.agentOrchestration.pattern}
              patternDescription={process.agentOrchestration.description}
              selected={selected}
              onSelect={setSelected}
            />
            <AgentDetail agent={selected} />
          </div>
        </details>
      </section>
    </div>
  );
}
