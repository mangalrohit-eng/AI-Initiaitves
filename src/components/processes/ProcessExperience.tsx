"use client";

import type { Process } from "@/data/types";
import { TabGroup } from "@/components/ui/TabGroup";
import { WorkTab } from "@/components/lenses/WorkTab";
import { WorkforceTab } from "@/components/lenses/WorkforceTab";
import { WorkbenchTab } from "@/components/lenses/WorkbenchTab";
import { DigitalCoreTab } from "@/components/lenses/DigitalCoreTab";
import { AgentDiagram } from "@/components/agents/AgentDiagram";
import { AgentDetail } from "@/components/agents/AgentDetail";
import { MetricPill } from "@/components/ui/MetricPill";
import * as React from "react";

export function ProcessExperience({ process }: { process: Process }) {
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
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold text-white">Agent architecture</h2>
            <p className="mt-1 text-sm text-white/60">Interactive orchestration map — select nodes to inspect contracts.</p>
          </div>
          <MetricPill label="Time savings (process)" value={`${process.estimatedTimeSavingsPercent}%`} />
        </div>

        <AgentDiagram
          agents={process.agents}
          flows={process.agentOrchestration.flow}
          patternLabel={process.agentOrchestration.pattern}
          patternDescription={process.agentOrchestration.description}
          selected={selected}
          onSelect={setSelected}
        />

        <AgentDetail agent={selected} />
      </section>
    </div>
  );
}
