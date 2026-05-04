"use client";

import * as React from "react";
import {
  X,
  Workflow,
  Users,
  Wrench,
  ServerCog,
  Bot,
  Layers,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import type {
  AIProjectResolved,
  AIProjectBriefLLM,
  AgentLLM,
  PlatformRequirementLLM,
  ToolStateLLM,
  RoleStateLLM,
  WorkStateLLM,
} from "@/lib/cross-tower/aiProjects";
import { formatUsdCompact } from "@/lib/format";

/**
 * Slide-over drawer rendering the full 4-lens project brief.
 *
 * Sections:
 *   - Header (project name, tower, L4, modeled $, value/effort badges)
 *   - LLM-authored narrative + brief.framing
 *   - Pain points
 *   - Work lens (pre/post step grids + key shifts)
 *   - Workforce lens (pre/post role tables + impact tier)
 *   - Workbench lens (pre/post tool stacks + key shifts)
 *   - Digital Core (platforms, data requirements, integrations, security)
 *   - Agents (table) + orchestration pattern
 *   - Constituent L5 initiatives + per-initiative inclusion rationale
 *
 * Stub projects render only the L5 list and a "Generation pending"
 * inline state.
 */

export function ProjectBriefDrawer({
  project,
  onClose,
}: {
  project: AIProjectResolved | null;
  onClose: () => void;
}) {
  const open = Boolean(project);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!project) return null;

  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-forge-ink/45 backdrop-blur-[2px] transition-opacity ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`${project.name} project brief`}
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-3xl transform flex-col border-l border-forge-border bg-forge-surface shadow-2xl transition-transform ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        <DrawerHeader project={project} onClose={onClose} />
        <div className="flex-1 overflow-y-auto bg-forge-surface px-6 py-5">
          {project.isStub ? (
            <StubBody project={project} />
          ) : project.brief ? (
            <FullBody project={project} brief={project.brief} />
          ) : (
            <StubBody project={project} />
          )}
        </div>
      </aside>
    </>
  );
}

function DrawerHeader({
  project,
  onClose,
}: {
  project: AIProjectResolved;
  onClose: () => void;
}) {
  return (
    <header className="border-b border-forge-border bg-forge-surface px-6 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-forge-border bg-forge-well px-2 py-0.5 text-[11px] font-medium text-forge-body">
              {project.primaryTowerName}
            </span>
            <span className="text-[11px] text-forge-subtle">
              <span className="text-forge-hint">L4 ·</span>{" "}
              {project.parentL4ActivityGroupName}
            </span>
          </div>
          <h2 className="mt-2 font-display text-xl font-semibold text-forge-ink">
            {project.name}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-forge-body">
            {project.narrative}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close brief"
          className="rounded-lg p-1 text-forge-subtle transition hover:bg-forge-well hover:text-forge-ink"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
        <Chip>
          <span className="text-forge-hint">Modeled</span>{" "}
          <span className="font-mono text-forge-body">
            {formatUsdCompact(project.attributedAiUsd)}
          </span>
        </Chip>
        {project.valueBucket ? (
          <Chip
            tone={project.valueBucket === "High" ? "purple" : "neutral"}
          >
            <span className="text-forge-hint">Value</span>{" "}
            <span className="font-mono">{project.valueBucket}</span>
          </Chip>
        ) : null}
        {project.effortBucket ? (
          <Chip
            tone={project.effortBucket === "Low" ? "green" : "amber"}
          >
            <span className="text-forge-hint">Effort</span>{" "}
            <span className="font-mono">{project.effortBucket}</span>
          </Chip>
        ) : null}
        {project.quadrant ? (
          <Chip
            tone={
              project.quadrant === "Quick Win"
                ? "green"
                : project.quadrant === "Strategic Bet"
                  ? "purple"
                  : project.quadrant === "Fill-in"
                    ? "teal"
                    : "red"
            }
          >
            <span className="text-forge-hint">Quadrant</span>{" "}
            <span className="font-mono">{project.quadrant}</span>
          </Chip>
        ) : null}
      </div>
    </header>
  );
}

function StubBody({ project }: { project: AIProjectResolved }) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-accent-amber/40 bg-forge-well p-4">
        <div className="flex items-start gap-2">
          <AlertTriangle
            className="mt-0.5 h-4 w-4 text-accent-amber"
            aria-hidden
          />
          <div className="text-sm text-forge-body">
            <p className="font-semibold text-accent-amber">
              Project brief pending generation.
            </p>
            <p className="mt-1 leading-relaxed">
              GPT-5.5 hasn&apos;t authored a brief for this L4 cohort yet — or
              the last attempt failed validation. Click{" "}
              <span className="font-medium text-forge-body">
                Retry project
              </span>{" "}
              on the card to refresh just this one without regenerating the
              whole plan.
            </p>
          </div>
        </div>
      </div>
      <ConstituentsSection project={project} />
    </div>
  );
}

function FullBody({
  project,
  brief,
}: {
  project: AIProjectResolved;
  brief: AIProjectBriefLLM;
}) {
  return (
    <div className="space-y-7">
      {/* Brief framing + pain points */}
      <section>
        <h3 className="font-display text-sm font-semibold text-forge-ink">
          Why this project
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-forge-body">
          {brief.framing}
        </p>
        {brief.currentPainPoints.length > 0 ? (
          <ul className="mt-3 space-y-1.5 text-sm text-forge-body">
            {brief.currentPainPoints.map((p, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1.5 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent-red" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {/* Value / Effort rationales */}
      {project.valueRationale || project.effortRationale ? (
        <section className="grid gap-3 sm:grid-cols-2">
          <RationaleBlock
            heading="Value rationale"
            bucket={project.valueBucket}
            text={project.valueRationale}
            bucketTone={project.valueBucket === "High" ? "purple" : "neutral"}
          />
          <RationaleBlock
            heading="Effort rationale"
            bucket={project.effortBucket}
            text={project.effortRationale}
            bucketTone={project.effortBucket === "Low" ? "green" : "amber"}
            footer={
              project.effortDrivers ? (
                <div className="mt-2 grid grid-cols-3 gap-1 text-[10px]">
                  <DriverPill
                    label="Integrations"
                    value={String(project.effortDrivers.integrationCount)}
                  />
                  <DriverPill
                    label="Agents"
                    value={String(project.effortDrivers.agentCount)}
                  />
                  <DriverPill
                    label="Platforms"
                    value={String(project.effortDrivers.platformCount)}
                  />
                </div>
              ) : null
            }
          />
        </section>
      ) : null}

      {/* Work lens */}
      <LensSection
        icon={<Workflow className="h-4 w-4 text-accent-purple" aria-hidden />}
        title="Work · how the workflow changes"
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <WorkStateBlock label="Pre" state={brief.work.pre} tone="pre" />
          <WorkStateBlock label="Post" state={brief.work.post} tone="post" />
        </div>
        <KeyShifts shifts={brief.work.keyShifts} />
      </LensSection>

      {/* Workforce lens */}
      <LensSection
        icon={<Users className="h-4 w-4 text-accent-teal" aria-hidden />}
        title="Workforce · how roles change"
        rightAside={
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${impactTierClasses(brief.workforce.workforceImpactTier)}`}
          >
            Impact · {brief.workforce.workforceImpactTier}
          </span>
        }
      >
        <p className="text-sm text-forge-body">
          {brief.workforce.workforceImpactSummary}
        </p>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <RoleColumn
            label="Pre"
            roles={brief.workforce.pre}
            tone="pre"
          />
          <RoleColumn
            label="Post"
            roles={brief.workforce.post}
            tone="post"
          />
        </div>
        <KeyShifts shifts={brief.workforce.keyShifts} />
      </LensSection>

      {/* Workbench lens */}
      <LensSection
        icon={<Wrench className="h-4 w-4 text-accent-purple-dark" aria-hidden />}
        title="Workbench · how the tool stack changes"
      >
        <div className="grid gap-3 lg:grid-cols-2">
          <ToolColumn label="Pre" tools={brief.workbench.pre} tone="pre" />
          <ToolColumn label="Post" tools={brief.workbench.post} tone="post" />
        </div>
        <KeyShifts shifts={brief.workbench.keyShifts} />
      </LensSection>

      {/* Digital Core */}
      <LensSection
        icon={<ServerCog className="h-4 w-4 text-accent-purple" aria-hidden />}
        title="Digital core · platforms + data + integrations"
      >
        <PlatformList platforms={brief.digitalCore.requiredPlatforms} />
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <BulletList
            heading="Data requirements"
            items={brief.digitalCore.dataRequirements}
          />
          <BulletList
            heading="Integrations"
            items={brief.digitalCore.integrations}
          />
        </div>
        <BulletList
          heading="Security considerations"
          items={brief.digitalCore.securityConsiderations}
        />
        <p className="mt-3 text-[11px] text-forge-subtle">
          <span className="text-forge-hint">Estimated build effort:</span>{" "}
          <span className="text-forge-body">
            {brief.digitalCore.estimatedBuildEffortSummary}
          </span>
        </p>
      </LensSection>

      {/* Agents + orchestration */}
      <LensSection
        icon={<Bot className="h-4 w-4 text-accent-purple" aria-hidden />}
        title="Agent fleet + orchestration"
        rightAside={
          <span className="inline-flex items-center gap-1 rounded-full border border-forge-border bg-forge-well px-2 py-0.5 text-[10px] font-medium text-forge-body">
            <Sparkles className="h-2.5 w-2.5" aria-hidden />{" "}
            {brief.agentOrchestration.pattern}
          </span>
        }
      >
        <p className="text-sm text-forge-body">
          {brief.agentOrchestration.description}
        </p>
        <AgentTable agents={brief.agents} />
      </LensSection>

      {/* Constituents */}
      <ConstituentsSection project={project} />
    </div>
  );
}

// ---------------------------------------------------------------------------
//   Section helpers
// ---------------------------------------------------------------------------

function LensSection({
  icon,
  title,
  rightAside,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  rightAside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-display text-sm font-semibold text-forge-ink">
            {title}
          </h3>
        </div>
        {rightAside}
      </header>
      {children}
    </section>
  );
}

function WorkStateBlock({
  label,
  state,
  tone,
}: {
  label: string;
  state: WorkStateLLM;
  tone: "pre" | "post";
}) {
  const toneBorder =
    tone === "pre"
      ? "border-forge-border bg-forge-well"
      : "border-accent-purple/40 bg-forge-well";
  return (
    <div className={`rounded-xl border ${toneBorder} p-3`}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-forge-subtle">
        {label}
      </div>
      <p className="mt-1 text-sm text-forge-body">{state.description}</p>
      <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
        <SmallChip>{state.avgCycleTime}</SmallChip>
        <SmallChip>{state.touchpointsSummary}</SmallChip>
        <SmallChip>{state.errorRateSummary}</SmallChip>
      </div>
      <ol className="mt-3 space-y-1.5 text-xs">
        {state.steps.map((s) => (
          <li key={s.step} className="flex gap-2">
            <span className="font-mono text-forge-hint">
              {String(s.step).padStart(2, "0")}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-forge-body">{s.action}</div>
              <div className="text-[10px] text-forge-hint">
                {s.owner} · {s.duration}
                {s.isManual ? " · manual" : ""}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function RoleColumn({
  label,
  roles,
  tone,
}: {
  label: string;
  roles: RoleStateLLM[];
  tone: "pre" | "post";
}) {
  const toneBorder =
    tone === "pre"
      ? "border-forge-border bg-forge-well"
      : "border-accent-teal/40 bg-forge-well";
  return (
    <div className={`rounded-xl border ${toneBorder} p-3`}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-forge-subtle">
        {label}
      </div>
      <ul className="mt-2 space-y-2 text-xs">
        {roles.map((r, i) => (
          <li key={i} className="border-b border-forge-border pb-2 last:border-b-0 last:pb-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-forge-ink">
                {r.role}
              </span>
              <span className="text-[10px] text-forge-hint">
                {r.headcountSummary}
              </span>
            </div>
            {r.primaryActivities.length > 0 ? (
              <ul className="mt-1 list-disc pl-4 text-[11px] text-forge-body">
                {r.primaryActivities.map((a, j) => (
                  <li key={j}>{a}</li>
                ))}
              </ul>
            ) : null}
            {r.skillsRequired.length > 0 ? (
              <div className="mt-1 flex flex-wrap gap-1">
                {r.skillsRequired.map((s, j) => (
                  <SmallChip key={j}>{s}</SmallChip>
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ToolColumn({
  label,
  tools,
  tone,
}: {
  label: string;
  tools: ToolStateLLM[];
  tone: "pre" | "post";
}) {
  const toneBorder =
    tone === "pre"
      ? "border-forge-border bg-forge-well"
      : "border-accent-purple/40 bg-forge-well";
  return (
    <div className={`rounded-xl border ${toneBorder} p-3`}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-forge-subtle">
        {label}
      </div>
      <ul className="mt-2 space-y-2 text-xs">
        {tools.map((t, i) => (
          <li key={i}>
            <div className="font-medium text-forge-ink">{t.tool}</div>
            <div className="text-[10px] text-forge-hint">{t.category}</div>
            <div className="text-forge-body">{t.usage}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PlatformList({
  platforms,
}: {
  platforms: PlatformRequirementLLM[];
}) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-forge-subtle">
        Required platforms
      </div>
      <ul className="mt-1 space-y-2 text-xs">
        {platforms.map((p, i) => (
          <li
            key={i}
            className="rounded-lg border border-forge-border bg-forge-well p-2"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-forge-ink">{p.platform}</span>
              <span
                className={`rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${priorityClasses(p.priority)}`}
              >
                {p.priority}
              </span>
            </div>
            <p className="mt-1 text-forge-body">{p.purpose}</p>
            {p.examples.length > 0 ? (
              <div className="mt-1 flex flex-wrap gap-1">
                {p.examples.map((x, j) => (
                  <SmallChip key={j}>{x}</SmallChip>
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AgentTable({ agents }: { agents: AgentLLM[] }) {
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-forge-border">
      <table className="w-full text-left text-xs">
        <thead className="bg-forge-well-strong text-[10px] uppercase tracking-wider text-forge-subtle">
          <tr>
            <th className="px-3 py-2">Agent</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Role</th>
            <th className="px-3 py-2">Tools</th>
          </tr>
        </thead>
        <tbody>
          {agents.map((a, i) => (
            <tr
              key={i}
              className="border-t border-forge-border align-top"
            >
              <td className="px-3 py-2 font-medium text-forge-ink">{a.name}</td>
              <td className="px-3 py-2">
                <span
                  className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${agentTypeClasses(a.type)}`}
                >
                  {a.type}
                </span>
              </td>
              <td className="px-3 py-2 text-forge-body">{a.role}</td>
              <td className="px-3 py-2">
                {a.toolsUsed.length === 0 ? (
                  <span className="text-forge-hint">—</span>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {a.toolsUsed.map((t, j) => (
                      <SmallChip key={j}>{t}</SmallChip>
                    ))}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConstituentsSection({ project }: { project: AIProjectResolved }) {
  const rationaleById = new Map(
    project.perInitiativeRationale.map((p) => [p.initiativeId, p.rationale]),
  );
  return (
    <section>
      <header className="mb-2 flex items-center gap-2">
        <Layers className="h-4 w-4 text-accent-teal" aria-hidden />
        <h3 className="font-display text-sm font-semibold text-forge-ink">
          Constituent L5 use cases ({project.constituents.length})
        </h3>
      </header>
      <ul className="space-y-2 text-sm">
        {project.constituents.map((row) => (
          <li
            key={row.id}
            className="rounded-xl border border-forge-border bg-forge-surface p-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-forge-ink">{row.name}</span>
              <span className="text-[11px] text-forge-hint">
                {row.l3Name} · {row.l2Name}
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-forge-body">
              <span className="text-forge-hint">Inclusion ·</span>{" "}
              {rationaleById.get(row.id) ??
                row.aiRationale ??
                "Rationale pending generation."}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function KeyShifts({ shifts }: { shifts: string[] }) {
  if (!shifts || shifts.length === 0) return null;
  return (
    <div className="mt-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-forge-subtle">
        Key shifts
      </div>
      <ul className="mt-1 space-y-1 text-xs text-forge-body">
        {shifts.map((s, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-1.5 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent-purple" />
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BulletList({
  heading,
  items,
}: {
  heading: string;
  items: string[];
}) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-forge-subtle">
        {heading}
      </div>
      <ul className="mt-1 space-y-1 text-xs text-forge-body">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-1.5 inline-block h-1 w-1 flex-shrink-0 rounded-full bg-forge-hint" />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RationaleBlock({
  heading,
  bucket,
  text,
  bucketTone,
  footer,
}: {
  heading: string;
  bucket: AIProjectResolved["valueBucket"];
  text: string;
  bucketTone: "purple" | "green" | "amber" | "neutral";
  footer?: React.ReactNode;
}) {
  if (!text) return null;
  const toneClass =
    bucketTone === "purple"
      ? "border-accent-purple/40 bg-forge-well"
      : bucketTone === "green"
        ? "border-accent-green/40 bg-forge-well"
        : bucketTone === "amber"
          ? "border-accent-amber/40 bg-forge-well"
          : "border-forge-border bg-forge-well";
  return (
    <div className={`rounded-xl border p-3 ${toneClass}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-forge-subtle">
          {heading}
        </span>
        {bucket ? (
          <span className="font-mono text-[11px] text-forge-body">{bucket}</span>
        ) : null}
      </div>
      <p className="mt-1 text-xs leading-relaxed text-forge-body">{text}</p>
      {footer}
    </div>
  );
}

function DriverPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-forge-border bg-forge-surface px-1.5 py-1 text-center">
      <div className="font-mono text-[11px] tabular-nums text-forge-ink">
        {value}
      </div>
      <div className="text-[9px] uppercase tracking-wider text-forge-hint">
        {label}
      </div>
    </div>
  );
}

function Chip({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "purple" | "green" | "amber" | "teal" | "red";
}) {
  const toneClass =
    tone === "purple"
      ? "border-accent-purple/50 bg-forge-well text-accent-purple-dark"
      : tone === "green"
        ? "border-accent-green/50 bg-forge-well text-accent-green"
        : tone === "amber"
          ? "border-accent-amber/50 bg-forge-well text-accent-amber"
          : tone === "teal"
            ? "border-accent-teal/50 bg-forge-well text-accent-teal"
            : tone === "red"
              ? "border-accent-red/45 bg-forge-well text-accent-red"
              : "border-forge-border bg-forge-well text-forge-body";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${toneClass}`}
    >
      {children}
    </span>
  );
}

function SmallChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-forge-border bg-forge-surface px-1.5 py-0.5 text-[10px] text-forge-body">
      {children}
    </span>
  );
}

function priorityClasses(p: PlatformRequirementLLM["priority"]): string {
  switch (p) {
    case "Critical":
      return "border-accent-red/50 bg-forge-well text-accent-red";
    case "Important":
      return "border-accent-amber/50 bg-forge-well text-accent-amber";
    default:
      return "border-forge-border bg-forge-well text-forge-body";
  }
}

function agentTypeClasses(type: AgentLLM["type"]): string {
  switch (type) {
    case "Orchestrator":
      return "border-accent-purple/50 bg-forge-well text-accent-purple-dark";
    case "Specialist":
      return "border-accent-teal/50 bg-forge-well text-accent-teal";
    case "Monitor":
      return "border-blue-500/50 bg-forge-well text-blue-600";
    case "Router":
      return "border-accent-amber/50 bg-forge-well text-accent-amber";
    case "Executor":
      return "border-accent-green/50 bg-forge-well text-accent-green";
    default:
      return "border-forge-border bg-forge-well text-forge-body";
  }
}

function impactTierClasses(tier: "High" | "Medium" | "Low"): string {
  switch (tier) {
    case "High":
      return "border-accent-purple/50 bg-forge-well text-accent-purple-dark";
    case "Medium":
      return "border-accent-amber/50 bg-forge-well text-accent-amber";
    default:
      return "border-forge-border bg-forge-well text-forge-body";
  }
}
