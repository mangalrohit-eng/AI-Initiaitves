"use client";

import * as React from "react";
import {
  ArrowDown,
  ArrowRight,
  Building2,
  Cpu,
  Database,
  Layers,
  Network,
  ShieldCheck,
  Signpost,
} from "lucide-react";
import type {
  ApiCadence,
  ApiDirection,
  ApiIntegration,
  DataArchitectureComponent,
  GovernancePolicy,
  OrchestrationAgent,
  OrchestrationLayer,
} from "@/data/types";
import { ORCHESTRATION_LAYER } from "@/data/orchestrationLayer";
import { TOWER_WORKBENCHES } from "@/data/towerWorkbenches";
import { resolveSolutionIcon } from "@/lib/initiatives/solutionIconAllowlist";
import { cn } from "@/lib/utils";

/**
 * Canonical, hand-authored Orchestration Layer artifact — sits above
 * (and demotes to "strategist commentary") the LLM-generated
 * `OrchestrationBlock` narrative on the Cross-Tower Orchestration tab.
 *
 * Renders five panels:
 *   1. Layered architecture diagram (Workbenches → Orchestration Layer
 *      → Point Solutions).
 *   2. Data architecture components (Identity Graph, Knowledge Graph,
 *      Content Lake, Event Bus, etc.).
 *   3. Named API integrations (BlackLine, Eightfold, Amagi, …).
 *   4. Cross-cutting AI agents (Identity Resolution, Content
 *      Classifier, Governance Auditor, …).
 *   5. Governance policies (SOX, FCC, editorial gate, …).
 *
 * Reads `ORCHESTRATION_LAYER` directly; no LLM dependency.
 */
export function CanonicalOrchestrationLayer({
  layer = ORCHESTRATION_LAYER,
}: {
  layer?: OrchestrationLayer;
}) {
  return (
    <div className="space-y-8">
      <CanonicalHeader layer={layer} />
      <LayeredArchitectureDiagram layer={layer} />
      <DataArchitecturePanel components={layer.dataArchitecture} />
      <ApiIntegrationMap integrations={layer.apiIntegrations} />
      <OrchestrationAgentsPanel agents={layer.agents} />
      <GovernancePoliciesPanel policies={layer.governance} />
    </div>
  );
}

// ===========================================================================
//   Header — narrative + build effort
// ===========================================================================

function CanonicalHeader({ layer }: { layer: OrchestrationLayer }) {
  return (
    <section
      aria-label="Orchestration Layer overview"
      className="rounded-2xl border border-accent-purple/30 bg-gradient-to-br from-accent-purple/10 via-forge-surface to-forge-surface p-6 shadow-[0_0_0_1px_rgba(161,0,255,0.10)]"
    >
      <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono uppercase tracking-[0.18em] text-accent-purple-light">
        <span>&gt;</span>
        <span>Canonical Orchestration Layer</span>
        <span className="text-forge-hint">·</span>
        <span className="text-forge-subtle">Hand-authored · cross-tower</span>
      </div>
      <h3 className="mt-2 font-display text-xl font-semibold text-forge-ink">
        The shared fabric every Tower Workbench plugs into
      </h3>
      <p className="mt-2 max-w-4xl text-sm leading-relaxed text-forge-body">
        {layer.narrative}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <HeaderStat
          label="Build effort"
          value={layer.buildEffort}
          Icon={Layers}
        />
        <HeaderStat
          label="Delivery"
          value={`${layer.estimatedDeliveryMonths} months`}
          Icon={Cpu}
        />
        <HeaderStat label="Pod shape" value={layer.podShape} Icon={Building2} />
      </div>

      <div className="mt-5 rounded-xl border border-forge-border bg-forge-well/40 p-4">
        <div className="text-[10px] font-mono uppercase tracking-wider text-forge-hint">
          Why shared (not initiative-by-initiative)
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-forge-body">
          {layer.whyShared}
        </p>
      </div>
    </section>
  );
}

function HeaderStat({
  label,
  value,
  Icon,
}: {
  label: string;
  value: string;
  Icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-xl border border-forge-border bg-forge-surface/80 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-forge-hint">
        <Icon className="h-3 w-3" aria-hidden />
        {label}
      </div>
      <div className="mt-1 text-xs text-forge-ink">{value}</div>
    </div>
  );
}

// ===========================================================================
//   Layered architecture diagram
// ===========================================================================

function LayeredArchitectureDiagram({ layer }: { layer: OrchestrationLayer }) {
  const workbenchEntries = Object.values(TOWER_WORKBENCHES);
  const sampleAgents = layer.agents.slice(0, 4);
  const sampleData = layer.dataArchitecture.slice(0, 4);
  const samplePointSolutions = Array.from(
    new Set(layer.apiIntegrations.map((i) => i.pointSolution)),
  ).slice(0, 12);

  return (
    <section aria-label="Layered architecture" className="space-y-3">
      <div>
        <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-forge-hint">
          &gt; Architecture
        </div>
        <h3 className="mt-1 font-display text-lg font-semibold text-forge-ink">
          How the layers stack
        </h3>
      </div>

      <div className="space-y-3 rounded-2xl border border-forge-border bg-forge-surface/70 p-5">
        <LayerBand
          tone="purple"
          eyebrow="Layer 1 · User"
          title={`${workbenchEntries.length} Tower Workbenches`}
          subtitle="One per functional tower. Each consolidates 4-8 surfaces in the tower's native vernacular."
        >
          <div className="flex flex-wrap gap-1.5">
            {workbenchEntries.map((w) => (
              <span
                key={w.id}
                className="inline-flex items-center rounded-full border border-accent-purple/30 bg-accent-purple/10 px-2 py-0.5 text-[11px] text-accent-purple-light"
              >
                {w.name.replace(" Workbench", "")}
              </span>
            ))}
          </div>
        </LayerBand>

        <DiagramConnector />

        <LayerBand
          tone="teal"
          eyebrow="Layer 2 · Shared fabric"
          title="Orchestration Layer"
          subtitle="The canonical data, identity, agent, and governance fabric every workbench plugs into. Cross-cutting agents work on behalf of every tower."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <DiagramSubBand
              label="Cross-cutting agents"
              items={sampleAgents.map((a) => a.name)}
              moreCount={Math.max(0, layer.agents.length - sampleAgents.length)}
            />
            <DiagramSubBand
              label="Data architecture"
              items={sampleData.map((d) => d.name)}
              moreCount={Math.max(0, layer.dataArchitecture.length - sampleData.length)}
            />
          </div>
        </LayerBand>

        <DiagramConnector />

        <LayerBand
          tone="slate"
          eyebrow="Layer 3 · Point solutions"
          title="Illustrative vendor point solutions"
          subtitle="Best-of-breed COTS that solve one slice apiece. The Orchestration Layer stitches them together; the Workbenches surface them. Vendors shown are illustrative anchors, not committed picks."
        >
          <div className="flex flex-wrap gap-1.5">
            {samplePointSolutions.map((p) => (
              <span
                key={p}
                className="inline-flex items-center rounded-full border border-forge-border bg-forge-well/40 px-2 py-0.5 text-[11px] text-forge-body"
              >
                {p}
              </span>
            ))}
            {layer.apiIntegrations.length > samplePointSolutions.length ? (
              <span className="inline-flex items-center rounded-full border border-dashed border-forge-border px-2 py-0.5 text-[11px] text-forge-subtle">
                + {layer.apiIntegrations.length - samplePointSolutions.length} more integrations
              </span>
            ) : null}
          </div>
        </LayerBand>
      </div>
    </section>
  );
}

function LayerBand({
  tone,
  eyebrow,
  title,
  subtitle,
  children,
}: {
  tone: "purple" | "teal" | "slate";
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const styles = {
    purple: {
      border: "border-accent-purple/40",
      bg: "bg-accent-purple/8",
      eyebrow: "text-accent-purple-light",
    },
    teal: {
      border: "border-accent-teal/40",
      bg: "bg-accent-teal/8",
      eyebrow: "text-accent-teal",
    },
    slate: {
      border: "border-forge-border-strong",
      bg: "bg-forge-well/50",
      eyebrow: "text-forge-subtle",
    },
  }[tone];

  return (
    <div className={cn("rounded-xl border-2 p-4", styles.border, styles.bg)}>
      <div
        className={cn(
          "text-[10px] font-mono uppercase tracking-[0.18em]",
          styles.eyebrow,
        )}
      >
        {eyebrow}
      </div>
      <div className="mt-1 flex flex-wrap items-baseline gap-2">
        <h4 className="font-display text-base font-semibold text-forge-ink">
          {title}
        </h4>
      </div>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-forge-body">
        {subtitle}
      </p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function DiagramSubBand({
  label,
  items,
  moreCount,
}: {
  label: string;
  items: string[];
  moreCount: number;
}) {
  return (
    <div className="rounded-lg border border-forge-border bg-forge-surface/80 p-3">
      <div className="text-[10px] font-mono uppercase tracking-wider text-forge-hint">
        {label}
      </div>
      <ul className="mt-1.5 space-y-1 text-[12.5px] text-forge-body">
        {items.map((i) => (
          <li key={i} className="flex items-start gap-1.5">
            <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-forge-hint" aria-hidden />
            <span>{i}</span>
          </li>
        ))}
      </ul>
      {moreCount > 0 ? (
        <div className="mt-1.5 text-[11px] text-forge-subtle">
          + {moreCount} more
        </div>
      ) : null}
    </div>
  );
}

function DiagramConnector() {
  return (
    <div className="flex justify-center">
      <ArrowDown className="h-5 w-5 text-forge-hint" aria-hidden />
    </div>
  );
}

// ===========================================================================
//   Panel 1 — data architecture
// ===========================================================================

function DataArchitecturePanel({
  components,
}: {
  components: DataArchitectureComponent[];
}) {
  return (
    <section aria-label="Data architecture components" className="space-y-3">
      <SectionHeader
        eyebrow="Data architecture"
        title="Where the data actually lives"
        count={`${components.length} components`}
        Icon={Database}
      />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {components.map((c) => (
          <DataComponentCard key={c.id} component={c} />
        ))}
      </div>
    </section>
  );
}

function DataComponentCard({ component }: { component: DataArchitectureComponent }) {
  const Icon = resolveSolutionIcon(component.iconKey, {
    feasibility: "ship-ready",
    seed: component.id,
  });
  const consumers = formatTowerList(component.primaryConsumers);
  const producers = formatTowerList(component.primaryProducers);

  return (
    <div className="flex h-full flex-col gap-3 rounded-2xl border border-forge-border bg-forge-surface/70 p-4 transition hover:border-accent-teal/40">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent-teal/40 bg-accent-teal/10 text-accent-teal"
        >
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center rounded-full border border-forge-border bg-forge-well/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-forge-subtle">
            {component.category}
          </span>
          <h4 className="mt-1.5 font-display text-base font-semibold text-forge-ink">
            {component.name}
          </h4>
        </div>
      </div>
      <p className="text-[12.5px] leading-relaxed text-forge-body">
        {component.description}
      </p>
      <dl className="grid grid-cols-2 gap-2 border-t border-forge-border/60 pt-3 text-[11px]">
        <Definition label="Consumers" value={consumers} />
        <Definition label="Producers" value={producers} />
        <Definition label="Tech" value={component.technologyChoice} colSpan={2} />
      </dl>
      {component.feedsFromPointSolutions.length > 0 ? (
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-forge-hint">
            Feeds from
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {component.feedsFromPointSolutions.map((s) => (
              <span
                key={`${component.id}-feed-${s}`}
                className="inline-flex items-center rounded-full border border-forge-border bg-forge-well/40 px-2 py-0.5 text-[11px] text-forge-body"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Definition({
  label,
  value,
  colSpan,
}: {
  label: string;
  value: string;
  colSpan?: 2;
}) {
  return (
    <div className={colSpan === 2 ? "col-span-2" : ""}>
      <dt className="font-mono text-[10px] uppercase tracking-wider text-forge-hint">
        {label}
      </dt>
      <dd className="mt-0.5 text-[11.5px] text-forge-body">{value}</dd>
    </div>
  );
}

function formatTowerList(list: string[] | "all"): string {
  if (list === "all") return "All 14 workbenches";
  if (list.length === 0) return "—";
  const names = list
    .map((id) => TOWER_WORKBENCHES[id]?.name.replace(" Workbench", "") ?? id)
    .slice(0, 4);
  const extra = list.length - names.length;
  return extra > 0 ? `${names.join(", ")} (+${extra})` : names.join(", ");
}

// ===========================================================================
//   Panel 2 — API integration map
// ===========================================================================

function ApiIntegrationMap({
  integrations,
}: {
  integrations: ApiIntegration[];
}) {
  return (
    <section aria-label="API integrations" className="space-y-3">
      <SectionHeader
        eyebrow="API integrations (illustrative)"
        title="How point solutions feed the layer"
        count={`${integrations.length} integrations`}
        Icon={Network}
      />
      <div className="overflow-hidden rounded-2xl border border-forge-border bg-forge-surface/70">
        <table className="min-w-full divide-y divide-forge-border text-left text-sm">
          <thead className="bg-forge-well/40">
            <tr>
              <Th>Integration</Th>
              <Th>Direction</Th>
              <Th>Protocol</Th>
              <Th>Cadence</Th>
              <Th>Consumers</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-forge-border/60">
            {integrations.map((i) => (
              <tr key={i.id} className="align-top">
                <td className="px-3 py-2.5">
                  <div className="font-display text-[13px] font-semibold text-forge-ink">
                    {i.name}
                  </div>
                  <div className="mt-0.5 text-[11px] text-forge-subtle">
                    Illustrative vendor: {i.pointSolution}
                  </div>
                  <code className="mt-1 block whitespace-pre-wrap rounded bg-forge-well/60 px-1.5 py-0.5 font-mono text-[10.5px] text-forge-body">
                    {i.payloadShape}
                  </code>
                </td>
                <td className="px-3 py-2.5">
                  <DirectionChip direction={i.direction} />
                </td>
                <td className="px-3 py-2.5">
                  <span className="inline-flex items-center rounded-full border border-forge-border bg-forge-well/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-forge-body">
                    {i.protocol}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <CadenceChip cadence={i.cadence} />
                </td>
                <td className="px-3 py-2.5 text-[12px] text-forge-body">
                  {formatTowerList(i.workbenchConsumers)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-left font-mono text-[10px] uppercase tracking-wider text-forge-hint">
      {children}
    </th>
  );
}

function DirectionChip({ direction }: { direction: ApiDirection }) {
  const styles: Record<ApiDirection, string> = {
    ingress: "border-accent-teal/40 bg-accent-teal/10 text-accent-teal",
    egress: "border-accent-purple/40 bg-accent-purple/10 text-accent-purple-light",
    bidirectional: "border-accent-amber/40 bg-accent-amber/10 text-accent-amber",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider",
        styles[direction],
      )}
    >
      {direction}
    </span>
  );
}

function CadenceChip({ cadence }: { cadence: ApiCadence }) {
  return (
    <span className="inline-flex items-center rounded-full border border-forge-border bg-forge-well/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-forge-body">
      {cadence}
    </span>
  );
}

// ===========================================================================
//   Panel 3 — cross-cutting agents
// ===========================================================================

function OrchestrationAgentsPanel({
  agents,
}: {
  agents: OrchestrationAgent[];
}) {
  return (
    <section aria-label="Cross-cutting agents" className="space-y-3">
      <SectionHeader
        eyebrow="Cross-cutting agents"
        title="Agents that work for every tower"
        count={`${agents.length} agents`}
        Icon={Signpost}
      />
      <div className="grid gap-3 md:grid-cols-2">
        {agents.map((a) => (
          <AgentCard key={a.id} agent={a} />
        ))}
      </div>
    </section>
  );
}

function AgentCard({ agent }: { agent: OrchestrationAgent }) {
  const Icon = resolveSolutionIcon(agent.iconKey, {
    feasibility: "ship-ready",
    seed: agent.id,
  });
  return (
    <div className="flex h-full flex-col gap-3 rounded-2xl border border-forge-border bg-forge-surface/70 p-4 transition hover:border-accent-purple/40">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent-purple/40 bg-accent-purple/10 text-accent-purple-light"
        >
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center rounded-full border border-forge-border bg-forge-well/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-forge-subtle">
            {agent.type}
          </span>
          <h4 className="mt-1.5 font-display text-base font-semibold text-forge-ink">
            {agent.name}
          </h4>
        </div>
      </div>
      <p className="text-[12.5px] leading-relaxed text-forge-body">{agent.role}</p>
      <div className="grid grid-cols-2 gap-3 border-t border-forge-border/60 pt-3">
        <BulletGroup label="Triggers" items={agent.triggers} />
        <BulletGroup label="Outputs" items={agent.outputs} />
      </div>
      <div className="text-[11px] text-forge-subtle">
        <span className="font-mono uppercase tracking-wider text-forge-hint">
          Serves:
        </span>{" "}
        {formatTowerList(agent.servesWorkbenches)}
      </div>
    </div>
  );
}

function BulletGroup({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-wider text-forge-hint">
        {label}
      </div>
      <ul className="mt-1 space-y-0.5 text-[11.5px] text-forge-body">
        {items.map((i) => (
          <li key={i} className="flex items-start gap-1.5">
            <span className="mt-1 inline-block h-1 w-1 shrink-0 rounded-full bg-forge-hint" />
            <span>{i}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ===========================================================================
//   Panel 4 — governance policies
// ===========================================================================

function GovernancePoliciesPanel({
  policies,
}: {
  policies: GovernancePolicy[];
}) {
  return (
    <section aria-label="Governance policies" className="space-y-3">
      <SectionHeader
        eyebrow="Governance"
        title="Policies enforced on every agent decision"
        count={`${policies.length} policies`}
        Icon={ShieldCheck}
      />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {policies.map((p) => (
          <PolicyCard key={p.id} policy={p} />
        ))}
      </div>
    </section>
  );
}

function PolicyCard({ policy }: { policy: GovernancePolicy }) {
  const Icon = resolveSolutionIcon(policy.iconKey, {
    feasibility: "ship-ready",
    seed: policy.id,
  });
  return (
    <div className="flex h-full flex-col gap-3 rounded-2xl border border-forge-border bg-forge-surface/70 p-4 transition hover:border-accent-amber/40">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent-amber/40 bg-accent-amber/10 text-accent-amber"
        >
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="font-display text-base font-semibold text-forge-ink">
            {policy.name}
          </h4>
        </div>
      </div>
      <p className="text-[12.5px] leading-relaxed text-forge-body">
        {policy.description}
      </p>
      <div className="border-t border-forge-border/60 pt-3 text-[11px]">
        <div className="text-[10px] font-mono uppercase tracking-wider text-forge-hint">
          Enforced by
        </div>
        <div className="mt-0.5 text-forge-body">{policy.enforcedBy}</div>
      </div>
      <div className="text-[11px]">
        <div className="text-[10px] font-mono uppercase tracking-wider text-forge-hint">
          Applies to
        </div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {policy.appliesTo.map((a) => (
            <span
              key={`${policy.id}-applies-${a}`}
              className="inline-flex items-center rounded-full border border-forge-border bg-forge-well/40 px-2 py-0.5 text-[11px] text-forge-body"
            >
              {a}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
//   Shared section header
// ===========================================================================

function SectionHeader({
  eyebrow,
  title,
  count,
  Icon,
}: {
  eyebrow: string;
  title: string;
  count: string;
  Icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3">
      <div>
        <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-[0.18em] text-forge-hint">
          <Icon className="h-3 w-3" aria-hidden />
          &gt; {eyebrow}
        </div>
        <h3 className="mt-1 font-display text-lg font-semibold text-forge-ink">
          {title}
        </h3>
      </div>
      <span className="font-mono text-[11px] uppercase tracking-wider text-forge-hint">
        {count}
      </span>
    </div>
  );
}
