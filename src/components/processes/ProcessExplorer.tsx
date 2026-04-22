"use client";

import type { Process } from "@/data/types";
import { TabGroup } from "@/components/ui/TabGroup";
import { WorkTab } from "@/components/lenses/WorkTab";
import { WorkforceTab } from "@/components/lenses/WorkforceTab";
import { WorkbenchTab } from "@/components/lenses/WorkbenchTab";
import { DigitalCoreTab } from "@/components/lenses/DigitalCoreTab";
import { AgentDiagram } from "@/components/agents/AgentDiagram";
import { AgentDetail } from "@/components/agents/AgentDetail";
import * as React from "react";

/** Alternate shell kept in sync with ProcessExperience (not wired to a route). */
export function ProcessExplorer({ process }: { process: Process }) {
  const [selected, setSelected] = React.useState<Process["agents"][number] | null>(process.agents[0] ?? null);

  React.useEffect(() => {
    setSelected(process.agents[0] ?? null);
  }, [process]);

  return (
    <div className="space-y-10">
      <TabGroup
        tabs={[
          { id: "work", label: "Work", content: <WorkTab process={process} /> },
          { id: "workforce", label: "Workforce", content: <WorkforceTab process={process} /> },
          { id: "workbench", label: "Workbench", content: <WorkbenchTab process={process} /> },
          { id: "digital", label: "Digital Core", content: <DigitalCoreTab process={process} /> },
        ]}
      />

      <section className="space-y-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-forge-ink">Agent architecture</h2>
          <p className="mt-1 text-sm text-forge-subtle">Interactive orchestration map — select nodes to inspect data contracts.</p>
        </div>

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

        <div className="rounded-2xl border border-forge-border border-l-4 border-l-accent-purple bg-forge-well p-4 text-sm text-forge-body">
          <span className="font-semibold text-forge-ink">Transformation outcome: </span>
          up to <span className="font-mono font-medium text-accent-purple-dark">{process.estimatedTimeSavingsPercent}%</span> cycle time reduction with{" "}
          <span className="font-mono text-forge-ink">{process.estimatedAnnualHoursSaved.toLocaleString()}</span> annual hours saved (estimated).
        </div>
      </section>
    </div>
  );
}
