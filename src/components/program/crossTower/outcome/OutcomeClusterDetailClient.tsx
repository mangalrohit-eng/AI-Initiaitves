"use client";

/**
 * Cross-Tower Outcome Cluster — brief detail page.
 *
 * Route: `/program/cross-tower-ai-plan/outcome/[clusterId]`.
 *
 * Reads the persisted strategist outputs, the live program state, and
 * the underlying four-lens briefs from each anchored AI Solution. All
 * dollar figures, vendor mixes, agent footprints, and build-vs-buy
 * ratios are deterministic rollups over the anchored solutions — the
 * LLM contributes only narrative.
 */

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CircuitBoard,
  Coins,
  Layers,
  ShieldCheck,
  Sparkles,
  Wand2,
} from "lucide-react";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { PageShell } from "@/components/PageShell";
import { composeProjectsV6 } from "@/lib/cross-tower/composeProjectsV6";
import { useCrossTowerAssumptions } from "@/lib/cross-tower/assumptions";
import { useProgramInitiativesV6 } from "@/lib/initiatives/useProgramInitiativesV6";
import { useReadPersistedStrategistOutputs } from "@/lib/llm/useStrategistOutputs";
import { getAssessProgram, subscribe } from "@/lib/localStore";
import type { AssessProgramV2 } from "@/data/assess/types";
import { buildProcessByInitiativeId } from "@/lib/strategist/processLookup";
import {
  aggregateAgents,
  aggregateLenses,
  aggregateSourcingMix,
  aggregateVendors,
  anchoredSolutionsForCluster,
  clusterRollupUsd,
  deriveValueTier,
  initiativeRollupUsd,
  type DerivedValueTier,
  type SourcingMix,
} from "@/lib/strategist/rollups";
import type {
  OutcomeCluster,
  StrategistInitiative,
} from "@/lib/strategist/types";
import type { AIProjectResolved } from "@/lib/cross-tower/aiProjects";
import { formatUsdCompact } from "@/lib/format";
import { useRedactDollars } from "@/lib/clientMode";
import type { Process } from "@/data/types";
import {
  ChipCloud,
  EmptySectionHint,
  RollupCard,
  Section,
  TowerChipRow,
  UnsizedHint,
  ValueCategoryChips,
  ValueTierBadge,
} from "./outcomeBriefShared";

// ---------------------------------------------------------------------
//   Live assess-program subscription
// ---------------------------------------------------------------------

function useLiveAssessProgram(): AssessProgramV2 {
  const [program, setProgram] = React.useState<AssessProgramV2>(() =>
    getAssessProgram(),
  );
  React.useEffect(() => {
    setProgram(getAssessProgram());
    return subscribe("assessProgram", () => setProgram(getAssessProgram()));
  }, []);
  return program;
}

// ---------------------------------------------------------------------
//   Main client
// ---------------------------------------------------------------------

export function OutcomeClusterDetailClient({
  clusterId,
}: {
  clusterId: string;
}) {
  const { assumptions } = useCrossTowerAssumptions();
  const program = useProgramInitiativesV6(assumptions.planThresholdUsd);
  const projects: AIProjectResolved[] = React.useMemo(
    () =>
      composeProjectsV6({
        initiatives: program.initiatives,
        narratives: undefined,
        assumptions,
      }),
    [program.initiatives, assumptions],
  );
  const strategistOutputs = useReadPersistedStrategistOutputs();
  const liveProgram = useLiveAssessProgram();
  const processByInitiativeId = React.useMemo(
    () => buildProcessByInitiativeId(liveProgram),
    [liveProgram],
  );

  const cluster: OutcomeCluster | null = React.useMemo(() => {
    if (!strategistOutputs) return null;
    return strategistOutputs.clusters.find((c) => c.id === clusterId) ?? null;
  }, [strategistOutputs, clusterId]);

  const initiativesInCluster: StrategistInitiative[] = React.useMemo(() => {
    if (!strategistOutputs || !cluster) return [];
    return strategistOutputs.initiatives.filter(
      (i) => i.clusterId === cluster.id,
    );
  }, [strategistOutputs, cluster]);

  return (
    <PageShell>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Program", href: "/" },
            {
              label: "Cross-Tower AI Plan",
              href: "/program/cross-tower-ai-plan",
            },
            { label: cluster?.title ?? "Outcome cluster" },
          ]}
        />

        <div className="mt-4">
          <Link
            href="/program/cross-tower-ai-plan"
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-forge-subtle transition hover:text-accent-purple-dark"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Back to Cross-Tower AI Plan
          </Link>
        </div>

        {!strategistOutputs ? (
          <EmptyStrategistState />
        ) : !cluster ? (
          <ClusterNotFound clusterId={clusterId} />
        ) : (
          <ClusterBriefBody
            cluster={cluster}
            initiatives={initiativesInCluster}
            projects={projects}
            processByInitiativeId={processByInitiativeId}
          />
        )}
      </div>
    </PageShell>
  );
}

// ---------------------------------------------------------------------
//   Brief body — six sections
// ---------------------------------------------------------------------

function ClusterBriefBody({
  cluster,
  initiatives,
  projects,
  processByInitiativeId,
}: {
  cluster: OutcomeCluster;
  initiatives: StrategistInitiative[];
  projects: AIProjectResolved[];
  processByInitiativeId: Map<string, Process | undefined>;
}) {
  const rollupUsd = clusterRollupUsd(cluster, initiatives, projects);
  const tier = deriveValueTier(rollupUsd);
  const anchoredSolutions = anchoredSolutionsForCluster(
    cluster,
    initiatives,
    projects,
  );
  const processes = anchoredSolutions.map((p) =>
    processByInitiativeId.get(p.id),
  );
  const vendors = aggregateVendors(anchoredSolutions);
  const sourcingMix = aggregateSourcingMix(processes);
  const agents = aggregateAgents(
    anchoredSolutions.map((p) => ({
      solutionId: p.id,
      process: processByInitiativeId.get(p.id),
    })),
  );
  const lensDigest = aggregateLenses(processes);

  return (
    <div className="mt-6 space-y-8">
      <ClusterHeader
        cluster={cluster}
        rollupUsd={rollupUsd}
        tier={tier}
        anchoredCount={anchoredSolutions.length}
      />

      <Section
        id="why-this-outcome"
        eyebrow="Why this outcome"
        title="Cross-tower context"
      >
        <p className="text-[13px] leading-relaxed text-forge-body">
          {cluster.narrative}
        </p>
        {cluster.headlineMetric ? (
          <p className="mt-3 text-[12px] text-forge-subtle">
            Headline metric:{" "}
            <span className="font-mono text-forge-body">
              {cluster.headlineMetric}
            </span>
          </p>
        ) : null}
        <CurrentFutureDigest initiatives={initiatives} />
      </Section>

      <Section
        id="initiatives"
        eyebrow="Discrete initiatives"
        title={`${initiatives.length} initiative${initiatives.length === 1 ? "" : "s"} in this cluster`}
      >
        {initiatives.length === 0 ? (
          <EmptySectionHint message="The strategist run produced no discrete initiatives for this cluster." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {initiatives.map((init) => (
              <InitiativeSummaryCard
                key={init.id}
                cluster={cluster}
                initiative={init}
                projects={projects}
              />
            ))}
          </div>
        )}
      </Section>

      <Section
        id="anchored-solutions"
        eyebrow="Anchored AI Solutions"
        title={`${anchoredSolutions.length} tower-specific solution${anchoredSolutions.length === 1 ? "" : "s"} power this outcome`}
      >
        {anchoredSolutions.length === 0 ? (
          <UnsizedHint scope="cluster" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {anchoredSolutions.map((p) => (
              <AnchoredSolutionCard key={p.id} project={p} />
            ))}
          </div>
        )}
      </Section>

      <Section
        id="agents"
        eyebrow="Agent footprint"
        title={`${agents.length} agent${agents.length === 1 ? "" : "s"} across anchored solutions`}
      >
        {agents.length === 0 ? (
          <EmptySectionHint message="No agent details cached on the anchored solutions yet. Open each solution brief to generate." />
        ) : (
          <AgentChipCloud agents={agents} />
        )}
      </Section>

      <Section
        id="build-vs-buy"
        eyebrow="Build vs Buy"
        title="Sourcing mix across anchored solutions"
      >
        <SourcingMixPanel mix={sourcingMix} vendors={vendors} />
        {lensDigest.digitalCorePlatforms.length > 0 ? (
          <div className="mt-4">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-forge-subtle">
              <span className="text-accent-purple-dark">&gt;</span> Required
              digital-core platforms
            </p>
            <ChipCloud
              labels={lensDigest.digitalCorePlatforms}
              tone="purple"
            />
          </div>
        ) : null}
        {lensDigest.workforceChanges.length > 0 ? (
          <div className="mt-3">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-forge-subtle">
              <span className="text-accent-purple-dark">&gt;</span> Workforce
              shifts
            </p>
            <ul className="mt-1 list-disc pl-5 text-[12px] leading-relaxed text-forge-body">
              {lensDigest.workforceChanges.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------
//   Header
// ---------------------------------------------------------------------

function ClusterHeader({
  cluster,
  rollupUsd,
  tier,
  anchoredCount,
}: {
  cluster: OutcomeCluster;
  rollupUsd: number | null;
  tier: DerivedValueTier;
  anchoredCount: number;
}) {
  const redact = useRedactDollars();
  const dollarLabel =
    rollupUsd === null
      ? "TBD — subject to discovery"
      : redact
        ? "—"
        : formatUsdCompact(rollupUsd, { decimals: 1 });
  return (
    <header className="mt-2 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
      <div className="max-w-3xl">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-purple/30 bg-accent-purple/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent-purple-dark">
          <Sparkles className="h-3 w-3" aria-hidden />
          Cross-tower outcome cluster
        </span>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-forge-ink sm:text-4xl">
          <span className="font-mono text-accent-purple-dark">&gt;</span>{" "}
          {cluster.title}
        </h1>
        <p className="mt-3 text-[13px] leading-relaxed text-forge-body">
          {cluster.narrative}
        </p>
        <TowerChipRow towers={cluster.towers} />
      </div>
      <div className="flex flex-col items-stretch gap-3 lg:items-end">
        <ValueTierBadge tier={tier} />
        <RollupCard
          label="Modeled cross-tower $"
          value={dollarLabel}
          footnote={
            anchoredCount === 0
              ? "Not yet anchored — regenerate the strategist run"
              : `Rolled up from ${anchoredCount} anchored AI Solution${anchoredCount === 1 ? "" : "s"}`
          }
        />
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------
//   Current → Future digest (section 2 supplement)
// ---------------------------------------------------------------------

function CurrentFutureDigest({
  initiatives,
}: {
  initiatives: StrategistInitiative[];
}) {
  if (initiatives.length === 0) return null;
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <div className="rounded-lg border border-forge-border bg-forge-well/30 p-3">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-forge-subtle">
          <span className="text-accent-purple-dark">&gt;</span> Today
        </p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[12px] leading-relaxed text-forge-body">
          {initiatives.slice(0, 4).map((i) => (
            <li key={`pre-${i.id}`}>{i.currentState}</li>
          ))}
        </ul>
      </div>
      <div className="rounded-lg border border-accent-purple/30 bg-accent-purple/5 p-3">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-accent-purple-dark">
          <span>&gt;</span> With this cluster live
        </p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[12px] leading-relaxed text-forge-body">
          {initiatives.slice(0, 4).map((i) => (
            <li key={`post-${i.id}`}>{i.futureState}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
//   Initiative summary card (section 3)
// ---------------------------------------------------------------------

function InitiativeSummaryCard({
  cluster,
  initiative,
  projects,
}: {
  cluster: OutcomeCluster;
  initiative: StrategistInitiative;
  projects: AIProjectResolved[];
}) {
  const rollupUsd = initiativeRollupUsd(initiative, projects);
  const tier = deriveValueTier(rollupUsd);
  const href = `/program/cross-tower-ai-plan/outcome/${cluster.id}/initiative/${initiative.id}`;
  const redact = useRedactDollars();
  const dollarLabel =
    rollupUsd === null
      ? "TBD"
      : redact
        ? "—"
        : formatUsdCompact(rollupUsd, { decimals: 1 });
  return (
    <Link
      href={href}
      className="group flex flex-col gap-2 rounded-lg border border-forge-border bg-forge-surface p-3 transition hover:border-accent-purple/50 hover:shadow-[0_0_0_1px_rgba(161,0,255,0.18)]"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-[13px] font-semibold leading-tight text-forge-ink group-hover:text-accent-purple-dark">
          {initiative.name}
        </h3>
        <ValueTierBadge tier={tier} />
      </div>
      <p className="text-[11.5px] text-forge-subtle">
        <Coins className="mr-1 inline h-3 w-3" aria-hidden />
        <span className="font-mono">{dollarLabel}</span>
        <span className="ml-1">
          · {(initiative.constituentSolutionIds ?? []).length} anchored
        </span>
      </p>
      <ValueCategoryChips categories={initiative.valueCategories} />
      <span className="mt-1 inline-flex items-center gap-1 self-start text-[10.5px] font-semibold text-accent-purple-dark group-hover:text-accent-purple">
        Open brief
        <ArrowRight className="h-3 w-3" aria-hidden />
      </span>
    </Link>
  );
}

// ---------------------------------------------------------------------
//   Anchored AI Solution card (section 4)
// ---------------------------------------------------------------------

function AnchoredSolutionCard({ project }: { project: AIProjectResolved }) {
  const redact = useRedactDollars();
  const dollarLabel = redact
    ? "—"
    : formatUsdCompact(project.attributedAiUsd, { decimals: 1 });
  return (
    <Link
      href={project.deepDiveHref ?? "#"}
      className="group flex flex-col gap-2 rounded-lg border border-forge-border bg-forge-well/30 p-3 transition hover:border-accent-purple/50 hover:bg-forge-well/55"
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-forge-subtle">
        {project.primaryTowerName}
        {project.l3FamilyName ? ` · ${project.l3FamilyName}` : ""}
      </p>
      <h3 className="font-display text-[13px] font-semibold leading-tight text-forge-ink group-hover:text-accent-purple-dark">
        {project.name}
      </h3>
      {project.tagline ? (
        <p className="text-[11.5px] leading-snug text-forge-subtle">
          {project.tagline}
        </p>
      ) : null}
      <div className="mt-1 flex flex-wrap items-center gap-2 text-[10.5px] text-forge-subtle">
        <span className="inline-flex items-center gap-1">
          <Coins className="h-3 w-3" aria-hidden />
          <span className="font-mono text-forge-body">{dollarLabel}</span>
        </span>
        {project.primaryVendor ? (
          <span className="rounded-full border border-forge-border bg-forge-surface px-1.5 py-0.5 text-[10px] font-medium text-forge-body">
            {project.primaryVendor}
          </span>
        ) : null}
        {project.quadrant ? (
          <span className="rounded-full border border-accent-purple/25 bg-accent-purple/5 px-1.5 py-0.5 text-[10px] font-medium text-accent-purple-dark">
            {project.quadrant}
          </span>
        ) : null}
      </div>
      <span className="mt-1 inline-flex items-center gap-1 self-start text-[10.5px] font-semibold text-accent-purple-dark group-hover:text-accent-purple">
        Open tower brief
        <ArrowRight className="h-3 w-3" aria-hidden />
      </span>
    </Link>
  );
}

// ---------------------------------------------------------------------
//   Agent chip cloud (section 5)
// ---------------------------------------------------------------------

function AgentChipCloud({
  agents,
}: {
  agents: ReturnType<typeof aggregateAgents>;
}) {
  const groups: Record<string, typeof agents> = {
    Orchestrator: [],
    Specialist: [],
    Monitor: [],
    Router: [],
    Executor: [],
  };
  for (const a of agents) groups[a.type].push(a);
  return (
    <div className="space-y-3">
      {Object.entries(groups)
        .filter(([, list]) => list.length > 0)
        .map(([type, list]) => (
          <div key={type}>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-forge-subtle">
              <span className="text-accent-purple-dark">&gt;</span> {type}
            </p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {list.map((a) => (
                <span
                  key={`${a.type}-${a.name}`}
                  title={`Used in ${a.solutionIds.length} anchored AI Solution${a.solutionIds.length === 1 ? "" : "s"}`}
                  className="inline-flex items-center gap-1 rounded-full border border-accent-teal/30 bg-accent-teal/5 px-2 py-0.5 text-[11px] font-medium text-accent-teal"
                >
                  <CircuitBoard className="h-3 w-3" aria-hidden />
                  {a.name}
                  <span className="font-mono text-[10px] text-forge-subtle">
                    ×{a.solutionIds.length}
                  </span>
                </span>
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}

// ---------------------------------------------------------------------
//   Sourcing mix panel (section 6)
// ---------------------------------------------------------------------

function SourcingMixPanel({
  mix,
  vendors,
}: {
  mix: SourcingMix;
  vendors: ReturnType<typeof aggregateVendors>;
}) {
  const total = mix.build + mix.buy + mix.discover + mix.unknown;
  if (total === 0) {
    return (
      <EmptySectionHint message="No anchored AI Solutions to roll up sourcing from yet." />
    );
  }
  const bar = (count: number, color: string) =>
    count > 0 ? (
      <div
        className={`h-full ${color}`}
        style={{ width: `${(count / total) * 100}%` }}
        aria-hidden
      />
    ) : null;
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full border border-forge-border bg-forge-well/30">
        {bar(mix.build, "bg-accent-purple")}
        {bar(mix.buy, "bg-accent-teal")}
        {bar(mix.discover, "bg-accent-amber")}
        {bar(mix.unknown, "bg-forge-border")}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-forge-body">
        <MixLegend label="Build" count={mix.build} dotClass="bg-accent-purple" />
        <MixLegend label="Buy" count={mix.buy} dotClass="bg-accent-teal" />
        <MixLegend
          label="Discover"
          count={mix.discover}
          dotClass="bg-accent-amber"
        />
        {mix.unknown > 0 ? (
          <MixLegend
            label="Brief pending"
            count={mix.unknown}
            dotClass="bg-forge-border"
          />
        ) : null}
      </div>
      {vendors.length > 0 ? (
        <div className="mt-4">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-forge-subtle">
            <span className="text-accent-purple-dark">&gt;</span> Primary
            vendors named
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {vendors.map((v) => (
              <span
                key={v.vendor}
                className="inline-flex items-center gap-1 rounded-full border border-forge-border bg-forge-well/30 px-2 py-0.5 text-[11px] font-medium text-forge-body"
              >
                <ShieldCheck className="h-3 w-3 text-accent-purple-dark" aria-hidden />
                {v.vendor}
                {v.count > 1 ? (
                  <span className="font-mono text-[10px] text-forge-subtle">
                    ×{v.count}
                  </span>
                ) : null}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MixLegend({
  label,
  count,
  dotClass,
}: {
  label: string;
  count: number;
  dotClass: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${dotClass}`} aria-hidden />
      <span>{label}</span>
      <span className="font-mono text-forge-subtle">{count}</span>
    </span>
  );
}

// ---------------------------------------------------------------------
//   Empty / fallback states
// ---------------------------------------------------------------------

function EmptyStrategistState() {
  return (
    <div className="mt-10 rounded-2xl border border-dashed border-forge-border bg-forge-surface p-8 text-center">
      <Wand2 className="mx-auto h-7 w-7 text-accent-purple-dark" aria-hidden />
      <h2 className="mt-3 font-display text-lg font-semibold text-forge-ink">
        No strategist run yet
      </h2>
      <p className="mx-auto mt-2 max-w-xl text-[13px] leading-relaxed text-forge-body">
        Open the Cross-Tower AI Plan, jump to the Cross-tower outcomes
        tab, and generate strategist outputs. Once they exist, this
        page will surface the cluster brief.
      </p>
      <Link
        href="/program/cross-tower-ai-plan"
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent-purple px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-purple-dark"
      >
        Open Cross-Tower AI Plan
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </div>
  );
}

function ClusterNotFound({ clusterId }: { clusterId: string }) {
  return (
    <div className="mt-10 rounded-2xl border border-dashed border-forge-border bg-forge-surface p-8 text-center">
      <Layers className="mx-auto h-7 w-7 text-forge-subtle" aria-hidden />
      <h2 className="mt-3 font-display text-lg font-semibold text-forge-ink">
        Outcome cluster not found
      </h2>
      <p className="mx-auto mt-2 max-w-xl text-[13px] leading-relaxed text-forge-body">
        The cluster id <code className="font-mono">{clusterId}</code> is
        not in the most recent strategist run. The strategist may have
        renamed or removed it on a regeneration. Open the Cross-Tower
        AI Plan to see the current cluster list.
      </p>
      <Link
        href="/program/cross-tower-ai-plan"
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent-purple px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-purple-dark"
      >
        Back to plan
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </div>
  );
}

